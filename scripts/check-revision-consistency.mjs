// Exercise the actual route functions offline: no API key or network involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let source = fs.readFileSync(new URL('../app/api/coach/route.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
source += '\nexport { validateLiveResult, ensureMinorRevisionConsistency, addRevisionComparison, explicitlySaysNoIssue, reviewCandidateFeedback, isStructurallyUnsupportedUniversalClaim, isStructurallyAbruptTopicShift, isStructurallyOverbroadThesis, schema };';
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} };
new Function('exports', 'require', 'module', compiled)(sandbox.exports, require, sandbox);
const f = sandbox.exports;
assert.ok(f.schema.properties.feedback.items.properties.category.enum.length >= 10);
assert.ok(!f.schema.properties.feedback.items.properties.category.enum.includes('语法'));
assert.equal(f.schema.properties.academicChecks.minItems,3);
assert.equal(f.schema.properties.academicChecks.maxItems,3);
assert.ok(f.schema.required.includes('academicChecks'));
const rejectedDraft = 'The number of students is increasing steadily.';
const reviewedEmpty = f.validateLiveResult({summary: '', feedback: [], modelRevision: rejectedDraft, overview: [], meaningRisk: ''}, rejectedDraft, 'rewrite', 0, true, false);
assert.equal(reviewedEmpty.feedback.length, 0, 'Final validation cannot reinsert a rejected rule candidate');
assert.equal(reviewedEmpty.modelRevision, rejectedDraft, 'Final validation cannot apply a rejected edit');
for (const draft of [
  'Students are relying on several independent sources to evaluate the claim.',
  'Relying on a single source can introduce bias.',
  'Does it help students evaluate evidence?',
  'How can it improve the quality of the analysis?',
  'The number of students is increasing steadily.',
]) {
  const output = f.validateLiveResult({summary: '', feedback: [], modelRevision: draft, overview: [], meaningRisk: ''}, draft, 'coach', 0, true);
  assert.equal(output.feedback.length, 0, `Correct construction must not be mechanically flagged: ${draft}`);
  assert.equal(output.modelRevision, draft);
}
const issue = (quote, correction, category = '主谓一致') => ({ quote, correction, category, why: '需要检查。', suggestion: '', confidence: '高' });
const numberDraft='The number of students is increasing steadily.';
assert.equal(f.validateLiveResult({feedback:[issue('students is','students is → students are')],modelRevision:numberDraft},numberDraft,'coach',0,false).feedback.length,0);
const pluralNumberDraft='A number of students is waiting outside.';
assert.ok(f.validateLiveResult({feedback:[],modelRevision:pluralNumberDraft},pluralNumberDraft,'coach',0,false).feedback.some(item=>item.quote==='students is'),'A number of takes plural agreement; do not suppress it like the number of');
const result = (feedback, draft) => ({ summary: '测试', feedback, modelRevision: draft, overview: [], meaningRisk: '' });
const original = 'Many students is using AI to review their writing. They notice teh feedback.';
const revised = original.replace('students is', 'students are');
const prior = [issue('students is', 'students is → students are'), issue('teh', 'teh → the', '拼写错误')];
let checks = 0;
function compare(draft, feedback, baseline = original, previous = prior) {
  const live = f.validateLiveResult(result(feedback, draft), draft, 'coach', 0, true);
  const output = f.addRevisionComparison(f.ensureMinorRevisionConsistency(live, draft, baseline, previous), draft, baseline, previous);
  const c = output.revisionComparison;
  assert.equal(c.remainingCount + c.changedCount + c.supplementalCount, output.feedback.length);
  assert.ok(output.feedback.every(item => draft.includes(item.quote)));
  checks++;
  return output;
}
for (const verdict of ['无；此处已正确。', '无需修改', '没有错误', 'No correction needed', 'Already correct.']) {
  const output = compare(revised, [issue('students are using AI', verdict)]);
  assert.ok(!output.feedback.some(item => item.quote.includes('students are')));
  assert.equal(output.revisionComparison.changedCount, 0);
  assert.ok(output.feedback.some(item => item.quote === 'teh'));
}
assert.equal(f.explicitlySaysNoIssue({ ...issue('word', '改为正确形式'), why: '语法正确，但仍有拼写错误。' }), false);
for (const mode of ['coach', 'model', 'rewrite']) {
  const validated = f.validateLiveResult(result([issue('students are using AI', '无；此处已正确。')], revised), revised, mode, 0, true);
  assert.ok(!validated.feedback.some(item => item.quote === 'students are using AI'));
}
assert.equal(compare(original, []).revisionComparison.remainingCount, 2);
assert.equal(compare(original + ' c', []).revisionComparison.remainingCount, 2);
const stillWrong = original.replace('students is', 'students was');
const wrongOutput = compare(stillWrong, [issue('students was', 'students was → students were')]);
assert.ok(!wrongOutput.revisionComparison.resolved.some(item => item.quote === 'students is'));
assert.ok(wrongOutput.feedback.some(item => item.revisionStatus === 'changed'));
const longWrong = compare(stillWrong, [issue('students was using AI to review their writing', 'students was → students were')]);
assert.ok(!longWrong.revisionComparison.resolved.some(item => item.quote === 'students is'));
assert.ok(longWrong.feedback.some(item => item.revisionStatus === 'changed'));
const added = compare(revised + ' People is waiting.', [issue('People is', 'People is → People are')]);
assert.ok(added.feedback.some(item => item.quote === 'People is' && item.revisionStatus === 'changed'));
const contextual = compare('The student is using AI.', [], 'The students is using AI.', [issue('is using AI', 'Use a plural verb')]);
assert.equal(contextual.feedback.length, 0);
const clean = compare(revised.replace('teh', 'the'), []);
assert.equal(clean.feedback.length, 0);
// Incident: changing is -> are in another sentence must not drop word-class errors.
const incident = original + ' They keep checking the answer careful.';
const wordClass = issue('checking the answer careful', 'careful → carefully', '词性选择');
const carriedWord = compare(incident.replace('students is', 'students are'), [], incident, [wordClass]);
assert.equal(carriedWord.revisionComparison.remainingCount, 1);
assert.equal(carriedWord.revisionComparison.resolved.length, 0);
const correctedWord = compare(incident.replace('answer careful', 'answer carefully'), [], incident, [wordClass]);
assert.ok(!correctedWord.feedback.some(item => item.quote === wordClass.quote));
const passage = 'But sometimes students just use the answer and do not think about whether it is correct.';
const fullPassage = passage + ' They may also accept invented information.';
const argument = issue(fullPassage, '补充因果解释，说明为什么需要教学。', '论证与解释');
const cohesion = issue(passage, '在后文补充因果或解释句。', '段落衔接');
const incidentDraft = original + ' ' + fullPassage;
const recategorized = compare(incidentDraft.replace('students is', 'students are'), [cohesion], incidentDraft, [argument]);
assert.equal(recategorized.revisionComparison.remainingCount, 1);
assert.equal(recategorized.feedback.find(item => item.quote === passage)?.revisionStatus, 'remaining');
assert.equal(recategorized.revisionComparison.resolved.length, 0);
const distinct = compare(incidentDraft.replace('students is', 'students are'), [issue(passage, '补充研究数据作为证据。', '段落衔接')], incidentDraft, [argument]);
assert.equal(distinct.feedback.find(item => item.quote === passage)?.revisionStatus, 'supplemental');
// Different, similarly long sentences must not be deduplicated merely by length.
const otherPassage = 'Teachers can design structured classroom activities that encourage learners to evaluate competing claims with evidence.';
const separate = f.addRevisionComparison(result([cohesion, issue(otherPassage, '补充因果解释。', '段落衔接')], incidentDraft + ' ' + otherPassage), incidentDraft + ' ' + otherPassage, incidentDraft, []);
assert.equal(separate.feedback.length, 2);
// A quote ending in a period must not swallow the changed following sentence.
const sentenceQuote = issue('They keep checking the answer careful.', 'careful → carefully', '词性选择');
const sentenceDraft = sentenceQuote.quote + ' ' + original;
assert.equal(compare(sentenceDraft.replace('students is', 'students are'), [], sentenceDraft, [sentenceQuote]).revisionComparison.remainingCount, 1);
const discourse = issue('students is', '需要补充证据。', '论证');
assert.ok(compare(original + ' c', [], original, [discourse]).feedback.some(item => item.category === '论证'));
const withEvidence = compare(original + ' A controlled comparison explains the reason.', [], original, [discourse]);
assert.ok(!withEvidence.feedback.some(item => item.category === '论证'));
const manyDraft = Array.from({ length: 45 }, (_, i) => `Token${i}`).join(' ');
const many = Array.from({ length: 45 }, (_, i) => issue(`Token${i}`, '需要补充论据。', '论证'));
const limited = f.addRevisionComparison(result([...many, many[0]], manyDraft), manyDraft, '', []);
assert.equal(limited.feedback.length, 36);
assert.equal(limited.revisionComparison.changedCount, 36);
const styleDraft = 'AI is really good for university students. They may also accept invented information.';
const broadStyle = issue('AI is really good for university students', '改用更准确的学术表达，说明具体益处。', '表达用语');
const preciseStyle = issue('really good', 'really good → beneficial。表达不够精确。', '学术表达 · 口语化且不精确');
const broadTerm = issue('They may also accept invented information.', '使用更自然的学术表达来说明 AI 可能生成虚假或错误信息。', '词性选择');
const preciseTerm = issue('invented information', 'invented information → fabricated information。术语更准确。', '学术表达 · 术语不够精确');
for (const suggestions of [[broadTerm, preciseTerm], [preciseTerm, broadTerm]]) {
  const merged = f.validateLiveResult(result(suggestions, styleDraft), styleDraft, 'coach', 0, true);
  const related = merged.feedback.filter(item => item.quote.includes('invented information'));
  assert.equal(related.length, 0, 'A preference between invented and fabricated is not an objective error');
}
const filteredPriorStyle = f.addRevisionComparison(result([], styleDraft), styleDraft, styleDraft, [broadStyle, preciseStyle, broadTerm, preciseTerm]);
assert.equal(filteredPriorStyle.revisionComparison.initialCount, 0, 'Previously accepted style preferences must be revalidated before reuse');
assert.equal(filteredPriorStyle.feedback.length, 0);
const genuineForm = issue('answer careful', '正式写作应使用副词修饰动作：careful → carefully。', '词性选择');
const formOutput = f.addRevisionComparison(result([genuineForm], 'They answer careful.'), 'They answer careful.', '', []);
assert.equal(formOutput.feedback[0].category, '词性选择');
const differentIssue = issue(preciseTerm.quote, '需要补充研究证据。', '论证与解释');
const distinctAdvice = f.addRevisionComparison(result([preciseTerm, differentIssue], styleDraft), styleDraft, '', []);
assert.equal(distinctAdvice.feedback.length, 2);
console.log(`Revision regression passed: ${checks} pipeline cases plus span/category/order regressions. No network or API usage.`);
const termSentence = issue('They may also accept invented information.', '可改为：They may also accept fabricated information.', '措辞精确性');
const quantity = issue('a lot of', 'a lot of → many / substantial / a considerable amount of。', '学术表达');
const speed = issue('finish work fast', 'finish work fast → complete tasks more efficiently。', '学术表达');
const combinedQuote = 'It gives a lot of feedback and students can finish work fast.';
const combined = issue(combinedQuote, '可改为：It gives substantial feedback and students can complete tasks more efficiently.', '措辞精确性');
const extra = issue(combinedQuote, '可改为：It provides substantial feedback and helps students complete tasks more efficiently.', '措辞精确性');
for (const feedback of [[preciseTerm, termSentence], [termSentence, preciseTerm]]) {
  const validated = f.validateLiveResult(result(feedback, styleDraft), styleDraft, 'coach', 0, true);
  const output = f.addRevisionComparison(validated, styleDraft, styleDraft, [preciseTerm]);
  assert.equal(output.feedback.length, 0);
  assert.equal(output.revisionComparison.initialCount, 0);
}
const crossRun = f.addRevisionComparison(f.validateLiveResult(result([termSentence], styleDraft), styleDraft, 'coach', 0, true), styleDraft, styleDraft, [preciseTerm]);
assert.equal(crossRun.feedback.length, 0);
const screenshotOriginal = 'Nowadays, AI is really good for university students. It gives a lot of feedback and students can finish work fast. For example, a student can ask a chatbot to improve an essay in a few seconds. But sometimes students just use the answer and do not think about whether it is correct. They may also accept invented information. Many students is using AI without checking the answer careful, and teh feedback can be confusing. I think universities should teach students how to evaluate AI feedback because it is important. This teaching can help students use technology in a responsible way and still develop their own judgement.';
const screenshotRevision = screenshotOriginal
  .replace('finish work fast', 'finish work faster')
  .replace('students is', 'students are')
  .replace('teh feedback', 'the feedback');
const screenshotPrior = [
  issue('finish work fast', 'finish work fast → complete tasks more efficiently。偏日常口语。', '学术表达 · 口语化表达'),
  issue('answer careful', 'answer careful → answer carefully。', '语言准确性 · 词形选择'),
  issue('I think', 'I think → This discussion suggests that。学术写作应避免个人化表达。', '学术表达 · 个人化表达'),
  issue('really good', 'really good → beneficial / effective。口语且不够精确。', '学术表达 · 口语化且不精确'),
  issue('a lot of', 'a lot of → many / substantial / a considerable amount of。口语化数量表达。', '学术表达 · 口语化数量表达'),
  issue('Nowadays', 'Nowadays → In recent years。时间表达不够精确。', '学术表达 · 时间表达不精确'),
  issue('just', 'just → a precise academic expression。该表达较口语化。', '学术表达 · 非正式用词'),
  issue('invented information', 'invented information → fabricated information。术语更正式、准确。', '学术表达 · 术语不够精确'),
  issue('students is', 'students is → students are。', '语言准确性 · 主谓一致'),
  issue('teh', 'teh → the。', '语言准确性 · 拼写错误'),
  issue('because it is important.', '补充具体理由，例如说明这样做有助于识别错误并保持独立判断。', '中心观点'),
];
const screenshotCandidates = [
  issue('answer careful', 'answer careful → answer carefully。', '语言准确性 · 词形选择'),
  issue('I think', 'I think → This essay argues that。使用更正式的学术语气。', '学术语气'),
  issue('just use the answer', 'just use the answer → simply use the answer。使用更正式的学术语气。', '学术语气'),
  issue('because it is important.', '说明一个原文能够支持的具体理由，不代写新的事实或证据。', '中心观点'),
];
const screenshotValidated = f.validateLiveResult(result(screenshotCandidates, screenshotRevision), screenshotRevision, 'coach', 0, true);
const screenshotCompared = f.addRevisionComparison(
  f.ensureMinorRevisionConsistency(screenshotValidated, screenshotRevision, screenshotOriginal, screenshotPrior),
  screenshotRevision,
  screenshotOriginal,
  screenshotPrior,
);
assert.equal(screenshotCompared.revisionComparison.initialCount, 4, 'Only objective language errors and a real argument gap belong in the baseline');
assert.deepEqual(screenshotCompared.revisionComparison.resolved.map(item => item.quote).sort(), ['students is', 'teh']);
assert.deepEqual(screenshotCompared.feedback.map(item => item.quote).sort(), ['answer careful', 'because it is important.']);
assert.equal(screenshotCompared.revisionComparison.remainingCount, 2);
assert.equal(screenshotCompared.revisionComparison.changedCount, 0);
assert.equal(screenshotCompared.revisionComparison.supplementalCount, 0);
assert.ok(!screenshotCompared.feedback.some(item => /I think|just use the answer|really good|a lot of|Nowadays|invented information|finish work faster/i.test(item.quote)));
assert.equal(screenshotCompared.feedback.find(item => item.quote.startsWith('because'))?.category, '学术建议 · 论证与证据');
const semanticShift = issue('finish work faster', 'finish work faster → complete tasks more efficiently。', '语言准确性 · 词形选择');
assert.equal(f.validateLiveResult(result([semanticShift], screenshotRevision), screenshotRevision, 'coach', 0, true).feedback.some(item => item.quote === semanticShift.quote), false, 'Speed must not be converted into efficiency under any category label');
for (const feedback of [[quantity, speed, combined], [combined, speed, quantity]]) {
  const output = f.addRevisionComparison(result(feedback, combinedQuote), combinedQuote, '', []);
  assert.equal(output.feedback.length, 2);
}
const partial = f.addRevisionComparison(result([quantity, speed, extra], combinedQuote), combinedQuote, '', []);
assert.equal(partial.feedback.length, 3, 'Additional edits must not be discarded');
const conflicting = issue('invented information', 'invented information → verified information。', preciseTerm.category);
assert.equal(f.addRevisionComparison(result([preciseTerm, conflicting], styleDraft), styleDraft, '', []).feedback.length, 2);
const negation = issue(termSentence.quote, '可改为：They may not accept fabricated information.', '措辞精确性');
assert.equal(f.addRevisionComparison(result([preciseTerm, negation], styleDraft), styleDraft, '', []).feedback.length, 2);
console.log('Concrete edit checks passed: cross-category, multi-edit coverage, alternatives, order, partial edits and negation.');
// Screenshot replay: correct agreement must not inherit a same-sentence adverb error.
const replayOriginal = 'Many students is using AI without checking the answer careful, and teh feedback can be confusing.';
const replayDraft = replayOriginal.replace('students is', 'students are');
const replayPrior = [issue('students is', 'students is → students are'), issue('answer careful', 'answer careful → answer carefully', '词形选择'), issue('teh', 'teh → the', '拼写错误')];
for (const prefix of ['改为 ', '可改为：', '修改为: ', '改为“', '可改为「', '改为"']) {
  const mislabeled = issue(replayDraft, prefix + replayDraft.replace('careful,', 'carefully,'), '主谓一致');
  for (const mode of ['coach', 'model', 'rewrite']) {
    const validated = f.validateLiveResult(result([mislabeled], replayDraft), replayDraft, mode, 0, true);
    const output = f.addRevisionComparison(f.ensureMinorRevisionConsistency(validated, replayDraft, replayOriginal, replayPrior), replayDraft, replayOriginal, replayPrior);
    assert.equal(output.revisionComparison.changedCount, 0);
    assert.equal(output.revisionComparison.resolved.length, 1);
    assert.equal(output.revisionComparison.resolved[0].quote, 'students is');
    assert.equal(output.feedback.filter(item => item.quote.includes('careful')).length, 1);
    assert.ok(!output.feedback.some(item => /主谓一致/.test(item.category)));
    assert.equal(output.revisionComparison.remainingCount, 2);
  }
}
const inaccurate = issue('They may also accept invented information.', '可改为 They may also accept fabricated or inaccurate information.', '论证与解释');
const wording = f.addRevisionComparison(result([inaccurate], styleDraft), styleDraft, '', []);
assert.equal(wording.feedback[0].category, '表达用语 · 替换建议');
const realReason = issue(passage, '可改为 ' + passage + ' This causes overreliance.', '论证与解释');
assert.equal(f.addRevisionComparison(result([realReason], incidentDraft), incidentDraft, '', []).feedback[0].category, '论证与解释');
console.log('Screenshot replay passed in all three modes and six replacement formats.');
const combinedGrammar = issue(replayDraft, '改为 ' + replayDraft.replace('careful,', 'carefully,').replace('teh', 'the'), '主谓一致');
const combinedValidated = f.validateLiveResult(result([combinedGrammar], replayDraft), replayDraft, 'coach', 0, true);
const combinedResult = f.addRevisionComparison(combinedValidated, replayDraft, replayOriginal, replayPrior);
assert.equal(combinedResult.revisionComparison.changedCount, 0);
assert.equal(combinedResult.revisionComparison.resolved[0].quote, 'students is');
assert.equal(combinedResult.feedback.length, 2);
const wrongAgreement = replayOriginal.replace('students is', 'students was');
const stillAgreement = compare(wrongAgreement, [issue('students was', '改为 students were', '主谓一致')], replayOriginal, replayPrior);
assert.ok(stillAgreement.feedback.some(item => /主谓一致/.test(item.category) && item.revisionStatus === 'changed'));

// A style keyword must not become an error when the contextual reviewer found none.
for (const draft of [
  'I think the result is plausible.',
  'Nowadays, the archive is available online.',
  'The algorithm returns just one result.',
  'The particles move fast.',
  'The researchers collected a lot of feedback.',
]) {
  assert.equal(f.validateLiveResult(result([], draft), draft, 'coach', 0, false).feedback.length, 0, draft);
}
const quotedDuplicate = issue('without checking the answer careful', '改为“without checking the answer carefully”。', '措辞精确');
const exactForm = issue('answer careful', 'answer careful → answer carefully', '词形选择');
assert.equal(f.addRevisionComparison(result([quotedDuplicate, exactForm], replayDraft), replayDraft, '', []).feedback.length, 1);
console.log('Accuracy boundary checks passed: valid style keywords and quoted duplicate suggestions.');
const adjacentConclusionDraft='Many students are using AI without checking the answer carefully, and the feedback can be confusing. I think universities should teach students how to evaluate AI feedback because it is important.';
const adjacentConclusionCandidate={...issue('Many students are using AI without checking the answer carefully, and the feedback can be confusing.','Many students are using AI without checking the answer carefully, and the feedback can be confusing. → Many students may use AI without checking carefully, so universities should teach them how to evaluate AI feedback.','学术建议 · 论证与证据'),why:'建议补充一个结论。'};
const duplicateFinal='Many students may use AI without checking carefully, so universities should teach them how to evaluate AI feedback. I think universities should teach students how to evaluate AI feedback because it is important.';
const adjacentFiltered=f.validateLiveResult(result([adjacentConclusionCandidate],duplicateFinal),adjacentConclusionDraft,'coach',0,true,false);
assert.equal(adjacentFiltered.feedback.length,0,'A correction must not restate the adjacent sentence conclusion');
const adjacentReviewed=await f.reviewCandidateFeedback(adjacentFiltered,adjacentConclusionDraft,'test-placeholder',new AbortController().signal);
assert.equal(adjacentReviewed.modelRevision,adjacentConclusionDraft,'Rejecting the duplicate advice must preserve the learner draft');
const nonDuplicateCandidate={...adjacentConclusionCandidate,correction:'Many students are using AI without checking the answer carefully, and the feedback can be confusing. → Some students may use AI feedback without checking its accuracy.'};
assert.equal(f.validateLiveResult(result([nonDuplicateCandidate],adjacentConclusionDraft),adjacentConclusionDraft,'coach',0,true,false).feedback.length,1,'A distinct local correction must remain eligible');
const nounDraft='The university website provides many informations about its academic support services.';
for (const feedback of [
  [issue('informations','informations → information','不可数名词'),issue('many informations','many informations → much information','不可数名词')],
  [issue('many informations','many informations → much information','不可数名词'),issue('informations','informations → information','不可数名词')],
  [{...issue('many informations','many informations → much information','语法'),why:'information 是不可数名词，many 不能修饰它。'}],
]) {
  const output=f.validateLiveResult(result(feedback,nounDraft),nounDraft,'rewrite',0,true);
  assert.equal(output.feedback.length,1,'Noun and determiner repair should be one complete recommendation');
  assert.equal(output.feedback[0].quote,'many informations');
  assert.ok(output.modelRevision.includes('much information'));
}
const runOn='The library extended its opening hours students still could not access specialist support.';
const badRunOn={...issue(runOn.slice(0,-1),'The library extended its opening hours → The library extended its opening hours; students still could not access specialist support','语法'),why:'前后是两个独立分句，没有连接。'};
const runOnOutput=f.validateLiveResult(result([badRunOn],runOn),runOn,'coach',0,false);
assert.equal(runOnOutput.feedback.length,1);
assert.ok(!runOnOutput.feedback[0].correction.includes('→'),'Do not duplicate a clause through an incorrectly scoped replacement');
const splice='Online feedback is immediate, the guidance may still fail to explain why a change is necessary.';
const spliceOutput=f.validateLiveResult(result([{...issue(splice,'immediate, the guidance → immediate. The guidance','语法'),why:'两个独立分句仅用逗号连接，构成逗号拼接。'}],splice),splice,'coach',0,false);
assert.equal(spliceOutput.feedback[0].category,'语言准确性 · 逗号拼接');
const coordinated='These functions may reduce the delay between writing and revision, and they may help teachers reserve meeting time for questions that require discussion.';
const falseSplice={...issue(coordinated,'comma splice → use a semicolon or split into two sentences','语言准确性 · 句子连接与标点'),why:'前后两个分句都是完整独立分句，用逗号直接连接会形成逗号拼接。'};
assert.equal(f.validateLiveResult(result([falseSplice],coordinated),coordinated,'coach',0,false).feedback.length,0,'A comma plus coordinating conjunction is not a comma splice');

const unsupportedForm = issue('a lot of feedback', '注意 feedback 的不可数用法，数量表达要用适合不可数名词的形式。', '词性选择');
assert.equal(f.validateLiveResult(result([unsupportedForm], combinedQuote), combinedQuote, 'coach', 0, false).feedback.length, 0);
const sameSentence = 'Nowadays, AI is really good for university students.';
const newStyle = issue('Nowadays', 'Nowadays → Today', '学术语气');
const oldStyle = issue('really good', '避免口语化强化词，改用更具体的表达。', '学术语气');
const unchangedSpan = f.addRevisionComparison(result([newStyle], sameSentence + ' Students are working.'), sameSentence + ' Students are working.', sameSentence + ' Students is working.', [oldStyle]);
assert.equal(unchangedSpan.revisionComparison.changedCount, 0, 'Unchanged sentence is not an edited location');
const preservedMeaning = 'In my opinion, the algorithm returns just one result. The particles move fast.';
assert.equal(f.validateLiveResult(result([], preservedMeaning), preservedMeaning, 'rewrite', 0, true).modelRevision, preservedMeaning, 'Postprocessing must not invent evidence or remove a numerical limitation');
for (const verb of ['check','checked','checking','reviewed','evaluating']) {
  const bad=`They are ${verb} the results careful.`;
  assert.ok(f.validateLiveResult(result([],bad),bad,'coach',0,false).feedback.some(item=>/carefully/.test(item.correction)),verb);
}
for (const good of ['They answer careful questions.', 'They are checking careful measurements.']) {
  assert.equal(f.validateLiveResult(result([],good),good,'coach',0,false).feedback.length,0,good);
}
const realFetch=globalThis.fetch;
try {
  globalThis.fetch=async (_url,options) => {
    const body=JSON.parse(options.body);
    assert.equal(body.store,false);
    return Response.json({output_text:JSON.stringify({approved:[],reason:'No necessary changes',modelRevision:preservedMeaning})});
  };
  const rejected=await f.reviewCandidateFeedback(result([issue('just one','删除 just','学术语气')],preservedMeaning),preservedMeaning,'test-placeholder',new AbortController().signal);
  assert.equal(rejected.feedback.length,0);
  assert.equal(rejected.modelRevision,preservedMeaning);
  const unsupportedUniversal="This tutoring method always improves every learner's performance.";
  const universalCandidate={...issue("always improves every learner's performance",'保留为需限定范围或补充证据的表述','学术建议 · 论点聚焦'),why:'未提供条件、例外或证据来支持普遍断言。'};
  const protectedResult=await f.reviewCandidateFeedback(result([universalCandidate],unsupportedUniversal),unsupportedUniversal,'test-placeholder',new AbortController().signal);
  assert.equal(protectedResult.feedback.length,1,'A reviewer fluctuation cannot delete a structurally proven universal empirical claim');
  const universalThesisMislabel={...universalCandidate,quote:unsupportedUniversal,category:'学术建议 · 论点聚焦'};
  const correctedUniversalCategory=f.validateLiveResult(result([universalThesisMislabel],unsupportedUniversal),unsupportedUniversal,'coach',0,false);
  assert.equal(correctedUniversalCategory.feedback[0].category,'学术建议 · 论证与证据','An unsupported universal empirical effect is an evidence problem, not a thesis-focus problem');
  const falseCompleteness={...issue(unsupportedUniversal,"always improves every learner's performance → can improve some learners' performance under specified conditions",'语言准确性 · 句子完整性'),why:'句法上可以成立，但逻辑上形成明显的过度概括和绝对断言。'};
  const broadEvidence={...universalCandidate,quote:unsupportedUniversal,category:'学术建议 · 论证与证据'};
  const mergedUniversal=f.validateLiveResult(result([falseCompleteness,broadEvidence],unsupportedUniversal),unsupportedUniversal,'coach',0,false);
  assert.equal(mergedUniversal.feedback.length,1,'A syntactically valid sentence must not appear as a second sentence-completeness card for the same scope problem');
  assert.equal(mergedUniversal.feedback[0].category,'学术建议 · 论证与证据');
  const logicalDefinition='Every square has four sides. A square therefore always has four vertices.';
  const logicalCandidate={...universalCandidate,quote:'always has four vertices'};
  const logicalResult=await f.reviewCandidateFeedback(result([logicalCandidate],logicalDefinition),logicalDefinition,'test-placeholder',new AbortController().signal);
  assert.equal(logicalResult.feedback.length,0,'Logical definitions are not protected as empirical intervention claims');
  const unsupportedCausal="The university introduced an online feedback platform. Consequently, the platform improved students' critical reasoning.";
  const causalCandidate={...issue("Consequently, the platform improved students' critical reasoning.","Consequently, the platform improved students' critical reasoning. → The platform may have improved students' critical reasoning, if supporting evidence is provided.",'学术建议 · 论证与证据'),why:'前一句只说明措施已实施，时间先后不足以支持直接因果结论。'};
  const causalProtected=await f.reviewCandidateFeedback(result([causalCandidate],unsupportedCausal),unsupportedCausal,'test-placeholder',new AbortController().signal);
  assert.equal(causalProtected.feedback.length,1,'A reviewer fluctuation cannot delete a structurally explicit introduction-then-causal-conclusion gap');
  const abruptDraft='Campus recycling can reduce waste. Artificial intelligence systems require transparent data governance.';
  const mislabeledAbrupt={...issue(abruptDraft,'增加明确过渡并说明两句之间的逻辑关系。','学术建议 · 论点聚焦'),why:'相邻两句的主题和中心对象不同，缺少过渡或关系说明。'};
  const abruptValidated=f.validateLiveResult(result([mislabeledAbrupt],abruptDraft),abruptDraft,'coach',0,false);
  assert.equal(abruptValidated.feedback[0].category,'学术建议 · 衔接与连贯','A two-sentence topic jump is a cohesion issue, not thesis focus');
  const protectedAbrupt=await f.reviewCandidateFeedback(result(abruptValidated.feedback,abruptDraft),abruptDraft,'test-placeholder',new AbortController().signal);
  assert.equal(protectedAbrupt.feedback.length,1,'A reviewer fluctuation cannot delete a structurally proven abrupt topic shift');
  const connectedDraft='Campus recycling can reduce waste. This approach reduces the amount of recyclable material sent to landfill.';
  const connectedCandidate={...mislabeledAbrupt,quote:connectedDraft,category:'学术建议 · 衔接与连贯'};
  const connectedResult=await f.reviewCandidateFeedback(result([connectedCandidate],connectedDraft),connectedDraft,'test-placeholder',new AbortController().signal);
  assert.equal(connectedResult.feedback.length,0,'An explicitly connected sentence pair is not protected as a topic shift');
  globalThis.fetch=async () => Response.json({output_text:JSON.stringify({approved:[999],reason:'bad',modelRevision:''})});
  await assert.rejects(()=>f.reviewCandidateFeedback(result([exactForm],replayDraft),replayDraft,'test-placeholder',new AbortController().signal),/Invalid review decision/);
} finally {globalThis.fetch=realFetch;}
console.log('Independent review contract passed: rejected edits, original preservation, and invalid IDs.');
const finalLanguage=f.validateLiveResult(result([],replayDraft),replayDraft,'rewrite',0,true).modelRevision;
assert.ok(!/\bteh\b|answer careful\b/.test(finalLanguage));
assert.ok(finalLanguage.includes('students are'));
const fragment='Although the university introduced a new writing centre.';
const fragmentOutput=f.validateLiveResult(result([issue(fragment,'补充主句或去掉 Although。','语法 · 句子残缺')],fragment),fragment,'coach',0,false);
assert.equal(fragmentOutput.feedback[0].category,'语言准确性 · 句子完整性');
const causal='Consequently, the platform improved reasoning.';
const causalOutput=f.validateLiveResult(result([issue(causal,'Consequently → However','学术建议 · 因果推断不足')],causal),causal,'coach',0,false);
assert.equal(causalOutput.feedback[0].category,'学术建议 · 论证与因果');
assert.ok(causalOutput.feedback[0].correction.includes('证据'));
const duplicateCausal="The university introduced an online feedback platform. Consequently, the platform improved students' critical reasoning.";
const duplicateQuote="Consequently, the platform improved students' critical reasoning.";
const duplicateOutput=f.validateLiveResult(result([
  {...issue(duplicateQuote,`${duplicateQuote} → Consequently, the platform may have improved students' critical reasoning, if supporting evidence is provided.`,'学术建议 · 论证与证据'),why:'直接因果结论缺少依据。'},
  {...issue(duplicateQuote,`${duplicateQuote} → The platform may have improved students' critical reasoning, if supporting evidence is provided.`,'学术建议 · 论证与证据'),why:'仅有措施引入不足以支持因果结论。'},
],duplicateCausal),duplicateCausal,'coach',0,false);
assert.equal(duplicateOutput.feedback.length,1,'Same-category candidates with the exact same quote are one underlying finding');
const threeSentenceCausal='Students began using an AI feedback tool in September. Their essay scores increased in October. Therefore, the tool caused the improvement.';
const causalMislabel={...issue(threeSentenceCausal,'将因果结论收紧为基于时间顺序的相关性判断，或补充能够支持因果的证据。','学术建议 · 衔接与连贯'),why:'这里只能确认时间先后，不能单凭这两句证明因果关系，中间缺少因果证据。'};
assert.equal(f.validateLiveResult(result([causalMislabel],threeSentenceCausal),threeSentenceCausal,'coach',0,false).feedback[0].category,'学术建议 · 论证与证据','Explicit temporal-to-causal evidence criticism must not remain mislabeled as cohesion');
const possibility='This teaching can help students develop their judgement.';
assert.equal(f.validateLiveResult(result([issue(possibility,'can help → may help','学术建议 · 论证审慎')],possibility),possibility,'coach',0,false).feedback.length,0);
const boundedStudy='In a controlled study of 24 volunteer learners, this tutoring method improved average quiz scores; the small sample limits generalisation.';
const noIssueCandidate={...issue(boundedStudy,'保持当前限定表述，无需强制改写','学术建议 · 论证与证据'),why:'当前表述没有扩展为普遍结论，不构成明显论证缺口。'};
assert.equal(f.validateLiveResult(result([noIssueCandidate],boundedStudy),boundedStudy,'coach',0,false).feedback.length,0,'A candidate that says no issue exists must not be displayed');
const causalDenial='Scores increased afterward, but this sequence alone does not establish that the platform caused the improvement.';
const denialCandidate={...issue(causalDenial,'改成更谨慎的相关性表述','学术建议 · 论证与证据'),why:'先后关系不能证明因果。'};
assert.equal(f.validateLiveResult(result([denialCandidate],causalDenial),causalDenial,'coach',0,false).feedback.length,0,'An explicit denial of causality must not be criticized for asserting causality');
const confoundQualified='Students began using an AI feedback tool in September, and essay scores increased in October. Because the course assessment also changed, this sequence does not establish that the tool caused the improvement.';
const firstSentenceCausalCandidate={...issue('Students began using an AI feedback tool in September, and essay scores increased in October.','补充因果证据或改为相关性表述','学术建议 · 论证与证据'),why:'这句话只有先后顺序，缺少因果证据。'};
assert.equal(f.validateLiveResult(result([firstSentenceCausalCandidate],confoundQualified),confoundQualified,'coach',0,false).feedback.length,0,'A following sentence that identifies a confound and denies causality must govern the preceding observation');
const effectQualified='A survey found that 15 of 24 volunteers preferred rapid feedback. The result describes preference in this small sample and does not show that automated comments improve academic achievement.';
const deniedEffectCandidate={...issue('does not show that automated comments improve academic achievement','限制为样本偏好或补充成绩证据','学术建议 · 论证与证据'),why:'没有成绩数据或因果证据支持 improve academic achievement。'};
assert.equal(f.validateLiveResult(result([deniedEffectCandidate],effectQualified),effectQualified,'coach',0,false).feedback.length,0,'An explicitly denied achievement effect must not be treated as an asserted effect');
const broadThesis='Technology affects society in many ways. Digital tools influence study, work, and communication.';
const broadOutput=f.validateLiveResult(result([],broadThesis),broadThesis,'coach',0,false);
assert.equal(broadOutput.feedback.length,1);
assert.equal(broadOutput.feedback[0].category,'学术建议 · 论点聚焦','A generic topic plus a domain list is a thesis-focus issue, not a cohesion issue');
assert.equal(f.isStructurallyOverbroadThesis(broadOutput.feedback[0],broadThesis),true,'A structurally proven overbroad thesis is marked for reviewer protection');
const squareDefinition="Every square has four sides. A square therefore always has four vertices.";
const definitionAdvice={...issue('A square therefore always has four vertices.','A square therefore always has four vertices. → A square has four vertices, by definition.','学术建议 · 论证与证据'),why:'原文没有额外说明这一几何关系的依据，最好明确这是基于定义或几何性质。'};
assert.equal(f.validateLiveResult(result([definitionAdvice],squareDefinition),squareDefinition,'coach',0,false).feedback.length,0,'A correct logical definition must not be treated as an unsupported empirical claim');
const focusedThesis='Universities should teach source verification because students need to evaluate AI-generated claims before using them in assessed work.';
assert.equal(f.validateLiveResult(result([],focusedThesis),focusedThesis,'coach',0,false).feedback.length,0,'A specific position with a reason must not be flagged as an overbroad thesis');
const selfContradictoryThesis={...issue('Universities should teach source verification','明确适用课程或学生范围','学术建议 · 论点聚焦'),why:'中心判断是清楚的，但还可以进一步限定范围。'};
assert.equal(f.validateLiveResult(result([selfContradictoryThesis],focusedThesis),focusedThesis,'coach',0,false).feedback.length,0,'Do not display a thesis issue that admits the thesis is already clear');
const descriptiveThesis='This essay discusses artificial intelligence in universities. AI is used for feedback, planning, and administration. These applications affect students and staff in different ways.';
const descriptiveOutput=f.validateLiveResult(result([],descriptiveThesis),descriptiveThesis,'coach',0,false);
assert.equal(descriptiveOutput.feedback.length,1);
assert.equal(descriptiveOutput.feedback[0].category,'学术建议 · 论点聚焦','A descriptive essay announcement plus lists still lacks a central claim');
assert.equal(f.isStructurallyOverbroadThesis(descriptiveOutput.feedback[0],descriptiveThesis),true);
const arguedOutline='This paper examines whether AI feedback improves revision accuracy. It argues that human review is necessary because automated comments may be wrong.';
assert.equal(f.validateLiveResult(result([],arguedOutline),arguedOutline,'coach',0,false).feedback.length,0,'An outline with a specific argued position is not an overbroad thesis');
const qualifiedPosition='Although automated feedback can reduce response time, universities should require human review in high-stakes assessment because unverified comments may affect grades.';
const riskSupportAdvice={...issue('because unverified comments may affect grades','保留这一风险判断，但补充其发生机制、条件或证据；不要把“可能”直接当作已证明的因果结论。','学术建议 · 论证与证据'),why:'这里直接给出可能影响成绩的因果理由，但没有说明机制，也未提供依据。'};
assert.equal(f.validateLiveResult(result([riskSupportAdvice],qualifiedPosition),qualifiedPosition,'coach',0,false).feedback.length,0,'A cautious risk premise must not be treated as a proven causal claim merely because its evidence is not inside the same thesis sentence');
const obviousReviewLink={...issue('universities should require human review in high-stakes assessment because unverified comments may affect grades','补充更直接的依据，或把主张限定为特定情境下的审慎建议。','学术建议 · 论证与证据'),why:'理由仍较笼统；尚未说明为何人类复核相比仅自动反馈更能降低该风险。'};
assert.equal(f.validateLiveResult(result([obviousReviewLink],qualifiedPosition),qualifiedPosition,'coach',0,false).feedback.length,0,'Do not demand a restatement of the self-explanatory link between review and unverified high-stakes feedback');
const connectedParagraph='Universities should teach source verification because students need to evaluate AI-generated claims. This training can help them compare claims with reliable evidence. Such comparison is especially important before students cite AI-generated material in assessed work.';
const admittedCohesion={...issue('This training can help them compare claims with reliable evidence. Such comparison is especially important before students cite AI-generated material in assessed work.','clarify the link between the comparison and assessed work','学术建议 · 衔接与连贯'),why:'两句之间逻辑上是帮助比较到比较的重要性，衔接基本成立，但还可以说明更多。'};
assert.equal(f.validateLiveResult(result([admittedCohesion],connectedParagraph),connectedParagraph,'coach',0,false).feedback.length,0,'Do not report a cohesion problem after admitting that the link is established');
const qualifiedEvidence='A survey found that 15 of 24 volunteers preferred rapid feedback. The result describes preference in this small sample and does not show that automated comments improve academic achievement.';
assert.equal(f.validateLiveResult(result([],qualifiedEvidence),qualifiedEvidence,'coach',0,false).feedback.length,0,'The result is an explicit anaphoric link when the previous sentence reports a survey finding');
const unrelatedDefiniteNoun='Campus recycling can reduce waste. The study of artificial intelligence requires transparent data governance.';
assert.ok(f.validateLiveResult(result([],unrelatedDefiniteNoun),unrelatedDefiniteNoun,'coach',0,false).feedback.some(item=>item.category==='学术建议 · 衔接与连贯'),'A definite noun without a matching antecedent must not hide an abrupt topic shift');
const longBlockShift='Students should verify generated claims before using them in assessed work. This verification practice helps them compare claims with reliable evidence. A short verification note can record the decision. Campus transport policy should reduce private car use. A transport plan can increase bus frequency and improve walking routes.';
const shiftedTopicCandidate={...issue('Campus transport policy should reduce private car use.','将交通内容移到独立段落','学术建议 · 论点聚焦'),why:'文章在此切换到另一个主题，后文核心焦点已转向交通政策。'};
const longBlockOutput=f.validateLiveResult(result([shiftedTopicCandidate],longBlockShift),longBlockShift,'coach',0,false);
assert.ok(longBlockOutput.feedback.some(item=>item.category==='学术建议 · 衔接与连贯'),'A sustained mid-passage topic launch must be classified as cohesion rather than thesis focus');
const longConnectedControl='Students should verify generated claims before using them in assessed work. This verification practice helps them compare claims with reliable evidence. A short verification note can record the decision. The note can then help tutors respond to the student’s reasoning. This response can guide later source checks.';
assert.equal(f.validateLiveResult(result([],longConnectedControl),longConnectedControl,'coach',0,false).feedback.filter(item=>item.category==='学术建议 · 衔接与连贯').length,0,'An explicitly connected long passage must not gain a deterministic cohesion warning');
const longformCases=JSON.parse(fs.readFileSync(new URL('../benchmarks/accuracy/academic-longform-cases.json',import.meta.url),'utf8')).cases;
for (const testCase of longformCases.filter(testCase=>testCase.polarity==='clear')) {
  const output=f.validateLiveResult(result([],testCase.draft),testCase.draft,'coach',0,false);
  const cohesionFeedback=output.feedback.filter(item=>item.category==='学术建议 · 衔接与连贯');
  assert.equal(cohesionFeedback.length,0,`Clear long-form control must not gain cohesion feedback: ${testCase.id} ${JSON.stringify(cohesionFeedback)}`);
}
const longCohesionCase=longformCases.find(testCase=>testCase.id==='long-cohesion-abrupt-shift');
assert.ok(f.validateLiveResult(result([],longCohesionCase.draft),longCohesionCase.draft,'coach',0,false).feedback.some(item=>item.category==='学术建议 · 衔接与连贯'),'A sustained, topically separate three-sentence block must produce cohesion feedback');
const qualifiedLongform=longformCases.find(testCase=>testCase.id==='long-scope-bounded-control').draft;
const qualifiedQuote='Their average revision score increased from the first assignment to the third assignment. This change may indicate that rapid comments supported repeated editing, although the design cannot isolate the tool from tutor meetings, additional practice, or growing familiarity with the assessment.';
const redundantWeakening={...issue(qualifiedQuote,'This change may indicate that rapid comments supported repeated editing → This change may indicate an association between rapid comments and repeated editing','学术建议 · 论证与证据'),why:'不宜把结果直接理解为工具 supported 修订的明确证据。'};
assert.equal(f.validateLiveResult(result([redundantWeakening],qualifiedLongform),qualifiedLongform,'coach',0,false).feedback.length,0,'Do not ask for a second hedge when the claim is already modal and explicitly names alternative explanations');
const observationOnly='Their average revision score increased from the first assignment to the third assignment.';
const inventedCausalReading={...issue(observationOnly,'将“分数上升”与“工具起作用”分开表述，并保留对其他因素的限制说明。','学术建议 · 论证与证据'),why:'该句本身不能单独支持“工具有效”的因果判断。'};
assert.equal(f.validateLiveResult(result([inventedCausalReading],qualifiedLongform),qualifiedLongform,'coach',0,false).feedback.length,0,'Do not invent a causal assertion in a descriptive observation when the immediately following sentence already qualifies it and lists alternative explanations');
assert.equal(f.validateLiveResult(result([issue('careful','careful → carefully','语法')],replayDraft),replayDraft,'coach',0,false).feedback.find(item=>item.quote==='careful').category,'语言准确性 · 词形选择');
assert.equal(f.validateLiveResult(result([issue('the answer careful','careful → carefully','冠词与不可数名词')],replayDraft),replayDraft,'coach',0,false).feedback.find(item=>item.quote==='the answer careful').category,'语言准确性 · 词形选择');
