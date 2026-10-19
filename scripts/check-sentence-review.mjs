import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nexport {languageReviewSentences,checkedSentenceFeedback,coveredByFullLanguageRepair,reviewCandidateFeedback,validateLiveResult,dedupeFeedback,normaliseFeedbackCategory,sentenceEditExplanation,agreementConsistencyIssues,narrativeTimeIssues,mannerAttachmentIssues,reconcileOperationalPast,preservesMeaningAnchors};';
const box={exports:{}};
new Function('exports','require','module',ts.transpileModule(fs.readFileSync(new URL('../app/api/coach/upstream.ts',import.meta.url),'utf8')+'\n'+source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box.exports,require,box);
const f=box.exports;
const numericDraft='The survey included forty students. Each student submitted one response. Forty-five different students answered the question.';
const numericItem={category:'学术建议 · 论证与证据',quote:'The survey included forty students. ... Forty-five different students answered the question.',why:'同一调查的总人数与答题人数矛盾。',correction:'核对原始记录，不猜测哪个数字正确。',confidence:'高'};
assert.equal(f.validateLiveResult({feedback:[numericItem]},numericDraft,'coach',0,false,false).feedback[0]?.quote,'Forty-five different students answered the question.');
assert.equal(f.validateLiveResult({feedback:[{...numericItem,quote:numericItem.quote.replace('forty students','eighty students')}]},numericDraft,'coach',0,false,false).feedback.length,0,'Fabricated excerpts cannot be rescued');
assert.equal(f.narrativeTimeIssues([{index:0,eventTime:'past_event',meaningToPreserve:'Every participant answered the questions.',replacement:'Every participant answers the questions.'}],['Every participant answer the questions.']).length,1);
assert.equal(f.narrativeTimeIssues([{index:0,eventTime:'past_event',meaningToPreserve:'Thirty students arrived.',replacement:'Thirty students arrived.'}],['Thirty student arrived.']).length,0,'Plural noun repairs are not tense drift');
for (const [quote, replacement, count] of [
 ['We study long‑term changes in high‑skill work.', 'We study long-term changes in high-skill work.', 0],
 ['Many company study long‑term changes.', 'Many companies study long-term changes.', 1],
]) {
 const found=f.checkedSentenceFeedback([{index:0,replacement,why:'核对',category:'语言准确性 · 词形选择',confidence:'高'}],[quote]);
 assert.equal(found.length,count);
 if(count) { assert.ok(found[0].correction.endsWith('Many companies study long‑term changes.')); assert.ok(!found[0].why.includes('“‑”')); }
}
assert.equal(f.checkedSentenceFeedback([{index:0,replacement:'We avoid negative effects.',why:'核对',category:'语言准确性 · 词形选择',confidence:'高'}],['We avoid negative effect.'])[0].category,'语言准确性 · 名词单复数');
const baseAction='The assistant record the results.';
const presentAction='The assistant records the results.';
assert.equal(f.reconcileOperationalPast(baseAction,presentAction,'past_event','They completed the test.','The average rose.'),'The assistant recorded the results.');
assert.equal(f.reconcileOperationalPast(baseAction,presentAction,'habit_or_general','They completed the test.','The average rose.'),presentAction);
assert.equal(f.reconcileOperationalPast(baseAction,presentAction,'past_event','','The average rose.'),presentAction);
assert.equal(f.reconcileOperationalPast('Now '+baseAction,'Now '+presentAction,'past_event','They completed the test.','The average rose.'),'Now '+presentAction);
assert.equal(f.reconcileOperationalPast('They will record it.','They will records it.','past_event','They completed the test.','The average rose.'),'They will records it.');
assert.equal(f.reconcileOperationalPast(baseAction,'The assistant records some results.','past_event','They completed the test.','The average rose.'),'The assistant records some results.');
for (const [before, after, count] of [
 ['Reporting measurements accurate is important.', 'Reporting accurate measurements is important.', 1],
 ['Reporting measurements accurate is important.', 'Reporting measurements accurately is important.', 0],
 ['Explaining procedures clear helps readers.', 'Explaining clear procedures helps readers.', 1],
 ['Explaining procedures clear helps readers.', 'Explaining procedures clearly helps readers.', 0],
 ['Reporting accurate measurements is important.', 'Reporting accurate measurements is important.', 0],
 ['Keeping water clear is important.', 'Keeping water clear is important.', 0],
]) assert.equal(f.mannerAttachmentIssues([{index:0,replacement:after}],[before]).length,count);
assert.equal(f.preservesMeaningAnchors('They provide free books.','They provide books.'),false);
assert.equal(f.preservesMeaningAnchors('They offer paid work.','They offer unpaid work.'),false);
assert.equal(f.preservesMeaningAnchors('They provides free books.','They provide free books.'),true);
const operational=['The assistant collect the forms.'];
assert.equal(f.narrativeTimeIssues([{index:0,timeEvidence:'这里描述收集这一已发生动作。',replacement:'The assistant collects the forms.'}],operational).length,1);
assert.equal(f.narrativeTimeIssues([{index:0,meaningToPreserve:'时间是过去的研究整理过程。',replacement:'The assistant collects the forms.'}],operational).length,1);
assert.equal(f.narrativeTimeIssues([{index:0,eventTime:'past_event',timeEvidence:'Earlier event.',replacement:'The assistant collects the forms.'}],operational).length,1);
assert.equal(f.narrativeTimeIssues([{index:0,eventTime:'habit_or_general',timeEvidence:'Ongoing habit.',replacement:'The assistant collects the forms.'}],operational).length,0);
assert.equal(f.narrativeTimeIssues([{index:0,timeEvidence:'这里描述收集这一已发生动作。',replacement:'The assistant collected the forms.'}],operational).length,0);
assert.equal(f.narrativeTimeIssues([{index:0,timeEvidence:'当前的一般习惯。',replacement:'The assistant collects the forms.'}],operational).length,0);
assert.equal(f.narrativeTimeIssues([{index:0,timeEvidence:'过去活动之后，现在每周收集。',replacement:'The assistant usually collects the forms.'}],['The assistant usually collect the forms.']).length,0);
for(const [quote,replacement] of [
 ['Before choose it, I checked it.','Before choosing it, I checked it.'],
 ['We spent the afternoon talk to visitors.','We spent the afternoon talking to visitors.'],
 ['After swim, she rested.','After swimming, she rested.'],
 ['We should avoid change several conditions.','We should avoid changing several conditions.'],
]) {
 const [item]=f.checkedSentenceFeedback([{index:0,replacement,why:'修改动词形式',category:'语言准确性 · 句子完整性',confidence:'高'}],[quote]);
 assert.equal(item.category,'语言准确性 · 时态与动词形式');
 assert.equal(item.correction,`${quote} → ${replacement}`);
}
assert.equal(f.sentenceEditExplanation('all young person.','all young people.'),'本句实际修改：“person” → “people”。');
assert.match(f.sentenceEditExplanation('They arrived, they wait.','They arrived. They waited.'),/wait.*waited/,'Explain edits after the first full stop too');
assert.match(f.sentenceEditExplanation('students work.','students’ work.'),/’/,'Keep possessive punctuation changes');
assert.match(f.sentenceEditExplanation('teenager life.','teenagers\' lives.'),/“teenagers' lives”/,'Display original substrings, not spaced-out apostrophes');
const singularContext=['In recent year, social media become useful.','Many researchers argue that it brings benefits.'];
assert.equal(f.agreementConsistencyIssues(singularContext,['In recent years, social media have become useful.',singularContext[1]]).length,1);
assert.equal(f.agreementConsistencyIssues(singularContext,['In recent years, social media has become useful.',singularContext[1]]).length,0);
assert.equal(f.agreementConsistencyIssues(['The data is useful.','They support the conclusion.'],['The data has been useful.','They support the conclusion.']).length,1);
assert.equal(f.agreementConsistencyIssues(['The data have been useful.','They support the conclusion.'],['The data have been useful.','They support the conclusion.']).length,0);
assert.equal(f.agreementConsistencyIssues(['The team are ready.','It starts tomorrow.'],['The team are ready.','It starts tomorrow.']).length,0,'Do not reject unchanged collective usage');
assert.equal(f.agreementConsistencyIssues(['The data look useful.','The students read them.'],['The data have looked useful.','The students read them.']).length,0,'Do not infer an unproven reference');
// Keep the identity-review contract independent of the deterministic article
// repair, which has dedicated positive/negative tests in check-sequential-fixes.
const original=JSON.parse(fs.readFileSync(new URL('../benchmarks/accuracy/social-media-body.json',import.meta.url))).draft.replace('a essential','an essential');
const item={category:'语言准确性 · 主谓一致',quote:'it bring',correction:'it bring → it brings',why:'主谓一致',confidence:'高',suggestion:''};
process.env.SENTENCE_LANGUAGE_REVIEW='0';
assert.equal(f.languageReviewSentences(original,Array(4).fill(item)).length,0,'Staged audit is off by default');
process.env.SENTENCE_LANGUAGE_REVIEW='1';
assert.equal(f.languageReviewSentences(original,[item]).length,11);
assert.equal(f.languageReviewSentences(original,[]).length,11);
assert.equal(f.languageReviewSentences('This is a short paragraph.').length,1,'Short drafts also receive complete sentence review');
const sentences=f.languageReviewSentences(original,Array(4).fill(item));
assert.equal(sentences.length,11);
assert.ok(!sentences.some(s=>s.startsWith('#')));
const checks=sentences.map((replacement,index)=>({index,replacement,why:'无需修改',category:item.category,confidence:'高'}));
assert.deepEqual(f.checkedSentenceFeedback(checks,sentences),[]);
assert.throws(()=>f.checkedSentenceFeedback(checks.slice(1),sentences),/Incomplete/);
assert.throws(()=>f.checkedSentenceFeedback(checks.map(c=>({...c,index:0})),sentences),/Invalid/);
const quote='The experiment show that limited used helps students.';
const full={...item,quote,correction:quote+' → The experiment shows that limited use helps students.'};
assert.equal(f.coveredByFullLanguageRepair({...item,quote:'The experiment show'},[full]),true);
assert.equal(f.coveredByFullLanguageRepair({...item,quote:'limited used'},[full]),true);
assert.equal(f.coveredByFullLanguageRepair({...item,quote:'helps students'},[full]),false);
assert.equal(f.coveredByFullLanguageRepair({...item,category:'学术建议 · 论证与证据'},[full]),false);
const saved=globalThis.fetch;
try{
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body), input=JSON.parse(body.input);
  assert.equal(input.sentences.length,11);
  assert.equal(input.candidates.length,0,'Language candidates must not anchor independent sentence review');
  assert.equal(body.text.format.schema.properties.approved.maxItems,0);
  assert.equal(body.text.format.schema.properties.sentenceChecks.minItems,11);
  const fields=Object.keys(body.text.format.schema.properties.sentenceChecks.items.properties);
  assert.ok(fields.indexOf('meaningToPreserve')<fields.indexOf('replacement'),'Record preserved meaning before generating repair');
  const corrected=checks.map(c=>({...c}));
  corrected[0]={...corrected[0],replacement:'In recent years, social media has become an essential part of teenagers’ daily lives.',why:'复数、时态、冠词和所有格。'};
  return Response.json({output_text:JSON.stringify({approved:[],reason:'checked',modelRevision:'',sentenceChecks:corrected})});
 };
 const result=await f.reviewCandidateFeedback({feedback:Array(4).fill(item),modelRevision:''},original,'test',new AbortController().signal);
 assert.equal(result.feedback.length,1,'Old partial cards must not survive sentence review');
 assert.equal(result.feedback[0].quote,sentences[0]);
 assert.ok(result.feedback[0].correction.startsWith(sentences[0]+' → '));
 const fromEmpty=await f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal);
 assert.equal(fromEmpty.feedback.length,1,'Zero first-pass candidates must still receive sentence review');
 const previousFetch=globalThis.fetch;
 let missingRevisionCalls=0;
 globalThis.fetch=async()=>{
  missingRevisionCalls++;
  const edited=checks.map(c=>({...c}));
  edited[0].replacement=edited[0].replacement.replace('recent year','recent years');
  return Response.json({output_text:JSON.stringify({approved:[],reason:'Checked.',sentenceChecks:edited,modelRevision:missingRevisionCalls===1?'':original.replace('recent year','recent years')})});
 };
 const assembled=await f.reviewCandidateFeedback({feedback:[],modelRevision:original},original,'test',new AbortController().signal);
 assert.equal(missingRevisionCalls,1,'Validated language repairs assemble without an unnecessary full-text retry');
 assert.equal(assembled.modelRevision,original.replace('recent year','recent years'));
 globalThis.fetch=previousFetch;
 const repaired=await f.reviewCandidateFeedback({feedback:[],modelRevision:original},original,'test',new AbortController().signal);
 assert.ok(repaired.modelRevision.includes('social media has become'));
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:checks})});
 const unchanged=await f.reviewCandidateFeedback({feedback:[],modelRevision:original},original,'test',new AbortController().signal);
 assert.deepEqual(unchanged.feedback,[]);
 assert.equal(unchanged.modelRevision,original,'A fully checked unchanged draft is the final text even if the model omits a redundant copy');
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:checks.slice(1)})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:original},original,'test',new AbortController().signal),/Incomplete/,'Missing sentence checks must not be treated as a clean draft');
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[0],reason:'invalid',modelRevision:'',sentenceChecks:checks})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal),/Invalid review decision/);
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input);
  assert.equal(input.candidates.length,1);
  assert.equal(input.candidates[0].index,0,'Candidate IDs are rebased after separating language review');
  assert.ok(input.candidates[0].category.startsWith('学术'));
  assert.equal(input.languageCandidates.length,1,'Retain the language candidate as a cross-check, not an approved item');
  assert.equal(input.languageCandidates[0].quote,item.quote);
  return Response.json({output_text:JSON.stringify({approved:[0],reason:'academic retained',modelRevision:'',sentenceChecks:checks})});
 };
 const academic={...item,category:'学术建议 · 论证与证据',quote:sentences[5],correction:'说明比较基准。'};
 const mixed=await f.reviewCandidateFeedback({feedback:[item,academic],modelRevision:''},original,'test',new AbortController().signal);
 assert.deepEqual(mixed.feedback,[academic],'Independent language audit must retain approved academic suggestions');
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],reason:'学术候选第0项成立：应提醒核对证据。',modelRevision:'',sentenceChecks:checks})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[academic],modelRevision:''},original,'test',new AbortController().signal),/Could not preserve/,'Do not silently drop a candidate explicitly approved in the explanation');
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],reason:'候选第0项不成立',modelRevision:'',sentenceChecks:checks})});
 const rejected=await f.reviewCandidateFeedback({feedback:[academic],modelRevision:''},original,'test',new AbortController().signal);
 assert.deepEqual(rejected.feedback,[],'Negative verdict is not an approval contradiction');
 const pastChecks=checks.map(c=>({...c}));
 pastChecks[0]={...pastChecks[0],replacement:'The organiser records the scores.',timeEvidence:'这里描述记录分数这一已发生动作。'};
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],reason:'checked',modelRevision:'',sentenceChecks:pastChecks})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal),/Could not preserve/,'A completed-event judgement cannot silently yield present records');
 let consistencyCalls=0;
 globalThis.fetch=async()=>{
  consistencyCalls++;
  const changed=checks.map(c=>({...c}));
  changed[0].replacement="In recent years, social media are an essential part of teenagers' daily life.";
  return Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:changed})});
 };
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal),/preserve meaning/);
 assert.equal(consistencyCalls,2,'Cross-sentence inconsistency must share the bounded retry');
 consistencyCalls=0;
 globalThis.fetch=async()=>{
  consistencyCalls++;
  const changed=checks.map(c=>({...c}));
  changed[0].replacement="In recent years, social media have become an essential part of teenagers' daily life.";
  return Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:changed})});
 };
 const normalized=await f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal);
 assert.match(normalized.feedback[0].correction,/social media has become/);
 assert.equal(consistencyCalls,1,'Known perfect auxiliary conflict needs no extra model call');
 // Frozen Chinese-route incident replay, not a new English live-model result.
 const failure=JSON.parse(fs.readFileSync(new URL('../benchmarks/accuracy/rejected-review-replay.json',import.meta.url)));
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(failure)});
 const trace={};
 const replay=await f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal,trace);
 assert.match(replay.feedback.find(i=>i.quote===sentences[0]).correction,/social media has become/);
 assert.equal(trace.agreementRepairs.length,1,'Keep the original model wording in local diagnostics');
 const falseExplanation=f.checkedSentenceFeedback([{index:0,replacement:'all young people.',why:'修正了比较级和时态。',category:item.category,confidence:'高'}],['all young person.']);
 assert.equal(falseExplanation[0].why,'本句实际修改：“person” → “people”。');
 let calls=0;
 globalThis.fetch=async()=>{
  calls++;
  const unsafe=checks.map(c=>({...c}));
  unsafe[4].replacement=unsafe[4].replacement.replace('will causes','causes');
  return Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:unsafe})});
 };
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal),/preserve meaning/);
 assert.equal(calls,2,'Unsafe meaning must retry once then abstain');
 calls=0;
 globalThis.fetch=async()=>{
  calls++;
  const repaired=checks.map(c=>({...c}));
  if(calls===1)repaired[4].replacement=repaired[4].replacement.replace('will causes','causes');
  return Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:repaired})});
 };
 await f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal);
 assert.equal(calls,2,'Safe second attempt is accepted');
 for(const [index,from,to] of [[4,'will','may'],[2,'150','15'],[9,'cannot','can'],[9,'all','some']]){
  calls=0;
  globalThis.fetch=async()=>{
   calls++;
   const unsafe=checks.map(c=>({...c}));
   unsafe[index].replacement=unsafe[index].replacement.replace(new RegExp(`\\b${from}\\b`),to);
   return Response.json({output_text:JSON.stringify({approved:[],modelRevision:'',sentenceChecks:unsafe})});
  };
  await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:''},original,'test',new AbortController().signal),/preserve meaning/);
  assert.equal(calls,2,`Reject altered anchor ${from}`);
 }
 process.env.SENTENCE_LANGUAGE_REVIEW='0'; // Isolate academic approval in these fixtures.
 const goalDraft='Our goal is to reuse paper. Throwing usable paper away does not meet that goal.';
 const goalItem={...academic,quote:'Throwing usable paper away does not meet that goal.',correction:'Use may instead.'};
 const goalEntry={index:0,goalQuote:'Our goal is to reuse paper.',actionAndGoalRelation:'Discarding usable paper is not reusing it.',claimType:'goal_consistency',verdict:'reject'};
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.ok(body.text.format.schema.required.includes('goalReviews'));return Response.json({output_text:JSON.stringify({approved:[],reason:'Goal relation is coherent.',modelRevision:'',goalReviews:[goalEntry]})});};
 assert.deepEqual((await f.reviewCandidateFeedback({feedback:[goalItem],modelRevision:''},goalDraft,'test',new AbortController().signal)).feedback,[]);
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[0],reason:'Inconsistent verdict',modelRevision:'',goalReviews:[goalEntry]})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[goalItem],modelRevision:''},goalDraft,'test',new AbortController().signal),/Invalid goal review/);
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],reason:'Unsupported quotation',modelRevision:'',goalReviews:[{...goalEntry,goalQuote:'Invented goal'}]})});
 await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[goalItem],modelRevision:''},goalDraft,'test',new AbortController().signal),/Invalid goal review/);
 const effectDraft='Our goal is higher scores. This app will achieve our goal for every student.';
 const effectItem={...academic,quote:'This app will achieve our goal for every student.',correction:'Check evidence for this universal claim.'};
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[0],reason:'Universal empirical effect unsupported.',modelRevision:'',goalReviews:[{...goalEntry,goalQuote:'Our goal is higher scores.',actionAndGoalRelation:'Improving scores requires evidence of actual effect.',claimType:'empirical_effect',verdict:'approve'}]})});
 assert.equal((await f.reviewCandidateFeedback({feedback:[effectItem],modelRevision:''},effectDraft,'test',new AbortController().signal)).feedback.length,1,'Do not suppress genuine effects merely because a goal is mentioned');
}finally{globalThis.fetch=saved;}
// Replay captured real model outputs through the same final dedupe/validation
// boundary, without another paid call. Inspect visible output, not just the audit.
const captured=JSON.parse(fs.readFileSync(new URL('../benchmarks/accuracy/visible-review-replay.json',import.meta.url)));
for(const run of captured.filter(r=>r.id.startsWith('original'))){
 const reviewed=f.checkedSentenceFeedback(run.data.accuracyStages.qualityReview.sentenceChecks,sentences);
 const final=f.validateLiveResult({feedback:f.dedupeFeedback(reviewed,original)},original,'coach',0,false,false);
 for(const item of reviewed){
  const visible=final.feedback.find(f=>f.quote===item.quote&&f.correction===item.correction);
  assert.ok(visible,`Reviewed repair disappeared: ${item.quote}`);
  assert.equal(visible.category,item.category,'Reviewed language category changed');
 }
 assert.equal(final.feedback.length,reviewed.length);
 assert.ok(!JSON.stringify(final).includes('reviewedSentenceLanguage'));
}
console.log('Sentence review: complete coverage, duplicate IDs, unchanged sentences, source quoting and duplicate suppression passed.');
