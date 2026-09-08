// Exercise the actual route functions offline: no API key or network involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let source = fs.readFileSync(new URL('../app/api/coach/route.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
source += '\nexport { validateLiveResult, ensureMinorRevisionConsistency, addRevisionComparison, explicitlySaysNoIssue };';
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} };
new Function('exports', 'require', 'module', compiled)(sandbox.exports, require, sandbox);
const f = sandbox.exports;
const issue = (quote, correction, category = '主谓一致') => ({ quote, correction, category, why: '需要检查。', suggestion: '', confidence: '高' });
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
for (const previous of [[broadStyle, preciseStyle], [preciseStyle, broadStyle], [broadStyle]]) {
  const matched = f.addRevisionComparison(result([preciseStyle], styleDraft), styleDraft, styleDraft, previous);
  assert.equal(matched.revisionComparison.initialCount, 1);
  assert.equal(matched.revisionComparison.resolved.length, 0);
  assert.equal(matched.revisionComparison.remainingCount, 1);
}
for (const suggestions of [[broadTerm, preciseTerm], [preciseTerm, broadTerm]]) {
  const merged = f.validateLiveResult(result(suggestions, styleDraft), styleDraft, 'coach', 0, true);
  const related = merged.feedback.filter(item => item.quote.includes('invented information'));
  assert.equal(related.length, 1);
  assert.equal(related[0].quote, 'invented information');
  assert.ok(!related.some(item => /词性/.test(item.category)));
}
const relabeled = f.addRevisionComparison(result([broadTerm], styleDraft), styleDraft, styleDraft, []);
assert.equal(relabeled.feedback[0].category, '学术表达 · 用语建议');
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
  const output = f.addRevisionComparison(result(feedback, styleDraft), styleDraft, styleDraft, [preciseTerm]);
  assert.equal(output.feedback.length, 1);
  assert.equal(output.revisionComparison.supplementalCount, 0);
}
const crossRun = f.addRevisionComparison(result([termSentence], styleDraft), styleDraft, styleDraft, [preciseTerm]);
assert.equal(crossRun.revisionComparison.remainingCount, 1);
assert.equal(crossRun.revisionComparison.resolved.length, 0);
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
for (const prefix of ['改为 ', '可改为：', '修改为: ']) {
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
console.log('Screenshot replay passed in all three modes and three replacement formats.');
const combinedGrammar = issue(replayDraft, '改为 ' + replayDraft.replace('careful,', 'carefully,').replace('teh', 'the'), '主谓一致');
const combinedValidated = f.validateLiveResult(result([combinedGrammar], replayDraft), replayDraft, 'coach', 0, true);
const combinedResult = f.addRevisionComparison(combinedValidated, replayDraft, replayOriginal, replayPrior);
assert.equal(combinedResult.revisionComparison.changedCount, 0);
assert.equal(combinedResult.revisionComparison.resolved[0].quote, 'students is');
assert.equal(combinedResult.feedback.length, 2);
const wrongAgreement = replayOriginal.replace('students is', 'students was');
const stillAgreement = compare(wrongAgreement, [issue('students was', '改为 students were', '主谓一致')], replayOriginal, replayPrior);
assert.ok(stillAgreement.feedback.some(item => /主谓一致/.test(item.category) && item.revisionStatus === 'changed'));
