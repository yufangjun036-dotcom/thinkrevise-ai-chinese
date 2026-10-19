import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nexport {checkedSentenceFeedback,assembleReviewedLanguageRevision,reviewCandidateFeedback,findLanguageIssues};';
const box={exports:{}};
new Function('exports','require','module',ts.transpileModule(fs.readFileSync(new URL('../app/api/coach/upstream.ts',import.meta.url),'utf8')+'\n'+source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box.exports,require,box);
const f=box.exports;
for(const sentence of ['I want to learn how to describe limited evidence accurately rather than make our small project sound more important than it is.', 'The results are clearer than they were last year.']) {
 assert.ok(!f.findLanguageIssues(sentence).some(x=>x.category.includes('连写句')),'Comparative subordinate clauses are not run-on sentences');
}
const runOn='The results are clear they are useful.';
assert.ok(f.checkedSentenceFeedback([{index:0,replacement:'The results are clear; they are useful.',why:'Two independent clauses need a boundary.',category:'语言准确性 · 句子连接与标点',confidence:'高'}],[runOn]).length===1,'Actual unconnected clauses remain supported by sentence review');
for(const sentence of ['We did not recorded how often these students had read before the room opened.','The materials we had used were stored safely.'])assert.ok(!f.findLanguageIssues(sentence).some(x=>x.category.includes('连写句')),'Lexical heuristics must not invent clause boundaries');
const original='Many students is using AI without checking the answer careful, and teh feedback can be confusing.';
const correct='Many students are using AI without checking the answer carefully, and the feedback can be confusing.';
const entry={index:0,replacement:correct,why:'Grammar.',category:'语言准确性 · 主谓一致',confidence:'高'};
const feedback=f.checkedSentenceFeedback([entry],[original]);
assert.equal(f.assembleReviewedLanguageRevision('Introduction.\n\n'+original+'\nConclusion.',feedback),'Introduction.\n\n'+correct+'\nConclusion.');
assert.equal(f.assembleReviewedLanguageRevision(original+' '+original,feedback),null);
assert.equal(f.assembleReviewedLanguageRevision(original,JSON.parse(JSON.stringify(feedback))),null,'Unverified feedback cannot assemble a rewrite');
assert.equal(f.assembleReviewedLanguageRevision(original,[...feedback,{category:'学术建议',quote:original}]),null);
assert.equal(f.assembleReviewedLanguageRevision(original,[]),null);
const tail=' Teachers encourage independent revision during writing lessons. Our class discusses how to preserve meaning when using feedback. We compare suggestions carefully and reject changes that alter our position. This process helps us practise judgement while keeping responsibility for the final paragraph.';
const ending=' Students also discuss each decision with a partner before submitting their work.';
const draft=original+tail+ending;
const sentences=Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(draft)).map(p=>p.segment.trim());
const checks=sentences.map((s,index)=>({...entry,index,replacement:index===0?correct:s}));
const saved=globalThis.fetch;
process.env.SENTENCE_LANGUAGE_REVIEW='1';
let calls=0;
try {
  globalThis.fetch=async()=>{calls++;return Response.json({output_text:JSON.stringify({approved:[],reason:'Only language repairs.',sentenceChecks:checks,modelRevision:'',englishFeedback:[]})});};
  const result=await f.reviewCandidateFeedback({feedback:[],modelRevision:draft},draft,'test',new AbortController().signal);
  assert.equal(result.modelRevision,correct+tail+ending);
  assert.equal(calls,1,'Missing redundant full text needs no paid retry when safe sentence repairs exist');
  globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],sentenceChecks:checks.map((e,i)=>i?e:{...e,replacement:correct.replace('are using','use')}),modelRevision:'',englishFeedback:[]})});
  await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:draft},draft,'test',new AbortController().signal),/preserve meaning/,'Progressive drift must fail closed');
  globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],sentenceChecks:checks,modelRevision:'',englishFeedback:[]})});
  const optional={category:'学术建议 · 表达精确性与语域',quote:'a fluent sentence',why:'这里意思基本清楚，但改成更具体的说法会更明确。',correction:'a fluent sentence → a precise sentence',confidence:'中'};
  assert.equal((await f.reviewCandidateFeedback({feedback:[optional],modelRevision:draft},draft,'test',new AbortController().signal)).feedback.length,1,'Optional polish is not a necessary correction');
  calls=0;
  globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({approved:[],sentenceChecks:checks.map((e,i)=>i?e:{...e,replacement:correct.replace('can be','will be')}),modelRevision:'',englishFeedback:[]})});
  await assert.rejects(()=>f.reviewCandidateFeedback({feedback:[],modelRevision:draft},draft,'test',new AbortController().signal),/preserve meaning/);
} finally {globalThis.fetch=saved;}
console.log('Reviewed rewrite assembly passed: empty full text, paragraph preservation, provenance, ambiguity, academic exclusion and meaning guard. No AI calls.');
