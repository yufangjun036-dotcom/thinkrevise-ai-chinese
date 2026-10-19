import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),box={exports:{}};
const source=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nexport {validateLiveResult,guardAcademicReplacement,checkedSentenceFeedback,separateAcademicPolarityEdit,conflictingEventTimeIssues,reviewCandidateFeedback,dedupeFeedback};';
new Function('exports','require','module','NextResponse','readLimitedJson','requestBodyLimits','acquireAiRequest',ts.transpileModule(fs.readFileSync(new URL('../app/text-limits.ts',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../app/api/coach/upstream.ts',import.meta.url),'utf8')+'\n'+source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box.exports,require,box,{json:Response.json},async r=>({ok:true,value:await r.json()}),{coach:100000},async()=>({ok:true,release:async()=>{}}));
const extra={exports:{}};
const helperSource=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nexport {reconcileUnappliedQuotedRepairs,attachEnglishFeedback,unresolvedComplementIssues,unappliedSentenceRepairIssues,omitDuplicateAnaphoricEvidence};';
new Function('exports','require','module',ts.transpileModule(helperSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(extra.exports,require,extra);
const f={...box.exports,reconcileUnappliedQuotedRepairs:extra.exports.reconcileUnappliedQuotedRepairs,attachEnglishFeedback:extra.exports.attachEnglishFeedback};
const partial=[{index:0,replacement:'The service provides a example.',why:'"a example" should be "an example."'}];
f.reconcileUnappliedQuotedRepairs(partial,['The service provide a example.'],[{quote:'a example',correction:'a → an'}]);
assert.equal(partial[0].replacement,'The service provides an example.','A corroborated article repair must survive another edit in the same sentence');
const unsupported=[{index:0,replacement:'The service provides a example.',why:'"a example" should be "an example."'}];
const unquoted=[{index:0,replacement:'The app provides a list and a example.',why:'The sentence has two errors: provide should be provides, and a should be an before example.'}];
f.reconcileUnappliedQuotedRepairs(unquoted,['The app provide a list and a example.'],[{quote:'The app provide a list and a example.',correction:'a example → an example'}]);
assert.equal(unquoted[0].replacement,'The app provides a list and an example.','Unquoted corroborated repair must use the original word position, not the first article');
const unquotedAgreement=[{index:0,replacement:'Their answers was recorded.',why:'was should be were because answers is plural.'}];
const capitalArticle=[{index:0,replacement:'A example follows.',why:'a should be an before example.'}];
f.reconcileUnappliedQuotedRepairs(capitalArticle,['A example follows.'],[{quote:'A example follows.',correction:'A example → An example'}]);
assert.equal(capitalArticle[0].replacement,'An example follows.','Reconciled fixes must preserve sentence-initial capitalization');
assert.equal(extra.exports.unresolvedComplementIssues('We will talk before submit it.','We will talk before submit it.').length,1);
assert.equal(extra.exports.unresolvedComplementIssues('Check it before use of the machine.','Check it before use of the machine.').length,0,'Nominal use of is not a bare verb complement');
assert.equal(extra.exports.unresolvedComplementIssues('We talk before we submit it.','We talk before we submit it.').length,0,'A complete finite clause after before is correct');
assert.equal(extra.exports.unappliedSentenceRepairIssues([{index:0,replacement:'We discuss it before submit it.',why:'submit should be corrected to the base form after before.'}],['We discuss it before submit it.']).length,1,'An English repair claim cannot accompany an unchanged sentence');
f.reconcileUnappliedQuotedRepairs(unquotedAgreement,['Their answers was recorded.'],[{quote:'Their answers was recorded.',correction:'was recorded → were recorded'}]);
assert.equal(unquotedAgreement[0].replacement,'Their answers were recorded.');
f.reconcileUnappliedQuotedRepairs(unsupported,['The service provide a example.'],[]);
assert.equal(unsupported[0].replacement,'The service provides a example.','Prose alone cannot authorize an uncorroborated replacement');
const translated={category:'学术建议 · 论证与证据',quote:'All students will benefit.',why:'对所有大学生推广证据不足。',correction:'该英文替换示例未通过原文匹配或代入检查。',confidence:'高',suggestion:''};
assert.ok(f.attachEnglishFeedback(translated,0,[{index:0,sourceQuote:translated.quote,why:'The effect claim for all university students is not supported.',correction:'The replacement was not accepted in source-matching checks.'}]).whyEnglish,'Faithful scope and withheld-example translations must not be rejected by phrasing');
const academic=(quote,correction)=>({category:'学术建议 · 论证与证据',quote,correction,why:'核对证据与当前断言的关系。',confidence:'高',suggestion:''});
const caution='The interviews do not establish whether the programme improved reading ability.';
assert.equal(f.validateLiveResult({feedback:[academic(caution,`${caution} → ${caution}`)]},caution,'coach',0,false,false).feedback.length,0,'Identity feedback must not demand an impossible rewrite');
const claim='The increase in height demonstrates that the plants became shorter.';
const substantive=academic(claim,'核对数据。'),principle=academic('This conclusion should follows directly from the measurements.','核对数据。'),grammar={...principle,category:'语言准确性 · 时态与动词形式'};
assert.deepEqual(extra.exports.omitDuplicateAnaphoricEvidence([substantive,principle,grammar],claim+' '+principle.quote),[substantive,grammar],'Merge the adjacent duplicate academic finding without removing its independent grammar repair');
assert.equal(extra.exports.omitDuplicateAnaphoricEvidence([principle],principle.quote).length,1,'No guessed deletion without an adjacent substantive finding');
const expression=(quote,correction)=>({...academic(quote,correction),category:'学术建议 · 表达精确性与语域'});
assert.match(f.guardAcademicReplacement(expression(claim,'demonstrates that the plants became shorter → should be revised to match the records'),claim).correction,/未通过原文匹配或代入检查/);
assert.equal(f.guardAcademicReplacement(expression(claim,'shorter → taller'),claim).correction,'shorter → taller');
assert.match(f.guardAcademicReplacement(expression(claim,'demonstrates that the plants became shorter → should be qualified to match the records'),claim).correction,/未通过原文匹配或代入检查/);
const evidenceReplacement=f.guardAcademicReplacement(academic(claim,'shorter → taller'),claim);
assert.ok(!evidenceReplacement.correction.includes('→'));assert.match(evidenceReplacement.correction,/不自动补写/);assert.ok(evidenceReplacement.correctionEnglish);
const inventedReception=f.guardAcademicReplacement(academic('These results prove the app improves learning.','prove the app improves learning → indicate the app was well received by all volunteers'),'Two volunteers found the instructions confusing.');
assert.ok(!inventedReception.correction.includes('well received'));assert.match(inventedReception.correction,/原文证据/);
assert.equal(f.checkedSentenceFeedback([{index:0,replacement:'The evidence supports this conclusion.',why:'移除连接词',category:'语言准确性 · 句子完整性',confidence:'高'}],['Therefore, the evidence supports this conclusion.']).length,0,'Removing a grammatical discourse marker is not a language error');
const broad='These results prove that the tool will help all learners.';
assert.equal(f.checkedSentenceFeedback([{index:0,replacement:'We did not change the schedule.',why:'did 后用原形',category:'语言准确性 · 句子完整性',confidence:'高'}],['We did not changed the schedule.'])[0].category,'语言准确性 · 时态与动词形式','An auxiliary verb-form repair is not a missing sentence component');
assert.equal(f.checkedSentenceFeedback([{index:0,replacement:"She doesn't go there.",why:'does 后用原形',category:'语言准确性 · 句子完整性',confidence:'高'}],["She doesn't goes there."])[0].category,'语言准确性 · 时态与动词形式');
assert.equal(f.checkedSentenceFeedback([{index:0,replacement:'It helps me find my notes quickly.',why:'使用副词',category:'语言准确性 · 词形选择',confidence:'高'}],['It helps me find my notes fast.']).length,0,'Fast is a valid flat adverb, not a grammar error');
assert.match(f.checkedSentenceFeedback([{index:0,replacement:'She speaks quickly.',why:'quick 应用副词形式',category:'语言准确性 · 词形选择',confidence:'高'}],['She speaks quick.'])[0].correction,/quickly/,'A genuine quick-to-quickly form repair must survive');
assert.match(f.checkedSentenceFeedback([{index:0,replacement:'He finds his notes quickly.',why:'主谓一致及可选措辞',category:'语言准确性 · 主谓一致',confidence:'高'}],['He find his notes fast.'])[0].correction,/→ He finds his notes fast\./,'Keep a real agreement repair while discarding optional synonym substitution');
const scopeItem=academic(broad,'prove → suggest');scopeItem.why='因果和推广结论缺少证据。';
assert.equal(f.dedupeFeedback([{...scopeItem,category:'语言准确性 · 句子完整性'},scopeItem]).length,2,'A mislabeled language finding cannot erase the academic candidate before review');
assert.equal(f.separateAcademicPolarityEdit(broad,'These results suggest that the tool may help some learners.',[academic(broad,'核对证据并限定结论。')]),broad,'Academic qualification must not leak into language repairs');
assert.notEqual(f.separateAcademicPolarityEdit('These result prove that the tool will help all learners.','These results suggest that the tool may help some learners.',[academic('These result prove that the tool will help all learners.','核对依据。')]),'These result prove that the tool will help all learners.','Do not silently discard real language edits mixed with academic edits');
for(const [before,after,expected]of [
 ['We ask everyone to return the form.','We asked everyone to return the form.','语言准确性 · 时态与动词形式'],
 ['Their answers was recorded.','Their answers were recorded.','语言准确性 · 主谓一致'],
 ['They can recieve help.','They can receive help.','语言准确性 · 拼写与大小写'],
])assert.equal(f.checkedSentenceFeedback([{index:0,replacement:after,why:'核对',category:'语言准确性 · 句子完整性',confidence:'高'}],[before])[0].category,expected);
const sequence=['We measured the plants.','Our instructor ask us to retain the notes.','We wrote down each result.'];
const entry={index:1,replacement:'Our instructor asks us to retain the notes.'};
const candidate={quote:sequence[1],correction:`${sequence[1]} → Our instructor asked us to retain the notes.`};
assert.equal(f.conflictingEventTimeIssues([entry],sequence,[candidate]).length,1);
assert.equal(f.conflictingEventTimeIssues([entry],sequence,[]).length,0,'A mere nearby past verb does not prove a separate habit wrong');
assert.equal(f.conflictingEventTimeIssues([{...entry,replacement:'Now our instructor asks us to retain the notes.'}],['We measured the plants.','Now our instructor ask us to retain the notes.',sequence[2]],[{quote:'Now our instructor ask us to retain the notes.',correction:'ask → asked'}]).length,0);
process.env.SENTENCE_LANGUAGE_REVIEW='0';
const transport=globalThis.fetch;
try{
 for(const [draft,kind,verdict,expected]of [
  ['The reported totals disagree, so we need to verify the records before using them.','acknowledged_uncertainty','approve',0],
  ['Our interpretation should be consistent with the measured values.','normative_principle','approve',0],
  ['The measured height rose during the activity.','descriptive_result','approve',0],
  ['Forty people participated. Forty-five different participants answered.','unresolved_inconsistency','approve',1],
  ['One participant tried the course. The course guarantees success for all students.','asserted_effect','approve',1],
 ]){
  globalThis.fetch=async(_url,options)=>{
   const body=JSON.parse(options.body);assert.ok(body.text.format.schema.required.includes('evidenceReviews'));
   const input=JSON.parse(body.input);
   assert.ok(body.text.format.schema.properties.evidenceReviews.items.required.includes('contextSentenceIndexes'));
   return Response.json({output_text:JSON.stringify({approved:[0],reason:'Evidence judgement.',englishFeedback:[],modelRevision:'',evidenceReviews:[{index:0,claimKind:kind,contextSentenceIndexes:input.contextSentences.map(x=>x.index),relation:'Current claim and evidence checked.',issueExists:verdict==='approve'}]})});
  };
  const result=await f.reviewCandidateFeedback({feedback:[academic(draft,'核对当前断言的依据。')],modelRevision:''},draft,'test',new AbortController().signal);
  assert.equal(result.feedback.length,expected,kind);
 }
 const pending='Forty people participated. Forty-five different participants answered.';
 globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[0],reason:'Records need verification.',englishFeedback:[],modelRevision:'',evidenceReviews:[{index:0,claimKind:'unresolved_inconsistency',contextQuote:pending,relation:'Counts conflict; no correct replacement number is known.',verdict:'approve'}]})});
 const pendingResult=await f.reviewCandidateFeedback({feedback:[academic(pending,'核对原始记录后再报告人数。')],modelRevision:pending},pending,'test',new AbortController().signal);
 assert.equal(pendingResult.feedback.length,1,'Pending factual work must remain visible');
 assert.equal(pendingResult.modelRevision,pending,'Missing facts must not cause invented data or an empty final draft');
}finally{globalThis.fetch=transport;}
const key=process.env.OPENAI_API_KEY,demo=process.env.THINKREVISE_DEMO_MODE;
try{
 process.env.OPENAI_API_KEY='fixture';process.env.THINKREVISE_DEMO_MODE='0';
 let calls=0;
 globalThis.fetch=async(_url,options)=>{
  calls++;const input=JSON.parse(JSON.parse(options.body).input);
  assert.equal(input.originalDraft,undefined);assert.equal(input.priorFeedback,undefined);
  assert.ok(!JSON.stringify(input).includes('OLD_FACT_45'),'Old facts must never enter independent detection');
  return Response.json({output_text:JSON.stringify({feedback:[],modelRevision:'',summary:'No issue.',overview:[],meaningRisk:''})});
 };
 const draft='The report describes the observations and clearly states the limits.';
 const response=await f.POST(new Request('http://localhost/api/coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'coach',phase:'revision',draft,originalDraft:'OLD_FACT_45 belongs only to the old draft.',priorFeedback:[]})}));
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal((await response.json()).modelRevision,draft);
}finally{globalThis.fetch=transport;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;if(demo===undefined)delete process.env.THINKREVISE_DEMO_MODE;else process.env.THINKREVISE_DEMO_MODE=demo;}
console.log('Evidence boundaries passed: no-op feedback, executable examples, tense/category consistency, acknowledged uncertainty, writing principles, descriptive results and real contradictions. No API calls.');
