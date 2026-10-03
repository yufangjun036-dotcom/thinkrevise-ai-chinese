import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'), cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('/coach/route.ts'))source+='\nexport {reviewCandidateFeedback,recoverUnlistedModalRepairs,normaliseFeedbackCategory,ignoresExistingQualifier};';
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require','module',js)(mod.exports,id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):createRequire(file)(id),mod);return mod.exports;
}
const f=load(path.join(root,'app/api/coach/route.ts'));
const recovered=f.recoverUnlistedModalRepairs({feedback:[],modelRevision:'Students can finish quickly.'},'Students can finishes quickly.');
assert.equal(recovered.feedback.length,1);
assert.equal(recovered.feedback[0].correction,'can finishes → can finish');
assert.equal(f.recoverUnlistedModalRepairs({feedback:[],modelRevision:'It is useful.'},'It is good.').feedback.length,0);
assert.equal(f.recoverUnlistedModalRepairs({feedback:[],modelRevision:'Students can fish quickly.'},'Students can finish quickly.').feedback.length,0);
const modal=f.normaliseFeedbackCategory({category:'语言准确性 · 主谓一致',quote:'They can draws pictures.',correction:'draws → draw',why:'原形 draws'});
assert.match(modal.why,/原形 draw，/);
assert.match(f.normaliseFeedbackCategory({category:'语言准确性 · 时态与动词形式',quote:'students can finishes work fast',correction:'students can finishes work fast → students can finish work fast',why:'原形 finishes'}).why,/原形 finish，/);
const scope={category:'学术建议 · 论证与证据',quote:'A few observations cannot tell us how every learner will perform.',why:'概括范围过大',correction:'收窄结论'};
assert.equal(f.ignoresExistingQualifier(scope,scope.quote),true);
assert.equal(f.ignoresExistingQualifier({...scope,quote:'This method cannot improve every learner.'},'This method cannot improve every learner.'),false);
assert.equal(f.ignoresExistingQualifier({...scope,quote:'Our data cannot prove that, but every learner will benefit.'},'Our data cannot prove that, but every learner will benefit.'),false);
const transport=load(path.join(root,'app/api/coach/upstream.ts'));
if(f.checkedSentenceFeedback){
 for(const [before,after,want] of [
  ['AI is really good for students.','AI is really useful for students.','AI is really good for students.'],
  ['The tools is good.','The tools are useful.','The tools are good.'],
  ['The software is important.','The software is significant.','The software is important.'],
  ['The feedback are helpful.','The feedback is beneficial.','The feedback is helpful.'],
  ['She sings good.','She sings well.','She sings well.'],
  ['The result is artifical.','The result is artificial.','The result is artificial.'],
 ]){
  assert.equal(f.preserveOptionalLexicalChoice(before,after),want);
  const checks=[{index:0,replacement:after,why:'核对语言',category:'语言准确性 · 词形选择',confidence:'高'}];
  const items=f.checkedSentenceFeedback(checks,[before]);
  assert.equal(checks[0].replacement,want);
  assert.equal(items.length,before===want?0:1);
 }
}
const originalFetch=globalThis.fetch;
let calls=0;
try{
 globalThis.fetch=async()=>{calls++;return calls===1?Response.json({error:{code:'server_error'}},{status:503}):Response.json({status:'completed'});};
 assert.equal((await transport.fetchCoachResponse('https://api.openai.com/v1/responses',{})).status,200);assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{code:'insufficient_quota'}},{status:429});};
 await assert.rejects(()=>transport.fetchCoachResponse('https://api.openai.com/v1/responses',{}),/AI_QUOTA_UNAVAILABLE/);assert.equal(calls,1);
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{code:'server_error'}},{status:503});};
 await assert.rejects(()=>transport.fetchCoachResponse('https://api.openai.com/v1/responses',{}),/AI_UPSTREAM_HTTP_503/);assert.equal(calls,2);
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});
 await assert.rejects(()=>transport.fetchCoachResponse('https://api.openai.com/v1/responses',{}),/AI_INCOMPLETE_RESPONSE/);
 assert.equal(transport.coachFailure(new DOMException('Timed out','TimeoutError'),false).code,'AI_TIMEOUT');
 assert.equal(transport.coachFailure(new Error('AI_QUOTA_UNAVAILABLE'),true).retryable,false);
 globalThis.fetch=async()=>Response.json({error:{code:'server_error'}},{status:503});
 // Test the actual POST failure path, not just the helper. No paid requests.
 process.env.OPENAI_API_KEY='test-placeholder';process.env.THINKREVISE_DEMO_MODE='0';process.env.REVISIONCOACH_DEMO_MODE='0';
 const response=await f.POST(new Request('http://127.0.0.1/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:'revision',mode:'coach',draft:'Students are reading in the library.'})}));
 const data=await response.json();assert.equal(response.status,503);assert.equal(data.provider,undefined);assert.equal(data.feedback,undefined);assert.equal(data.code,'AI_REVIEW_UNAVAILABLE');
 if(!f.checkedSentenceFeedback){
  // Regression: valid review rejects optional wording and omits redundant final
  // copy. This must return the unchanged draft, not fall back to demo feedback.
  globalThis.fetch=async()=>Response.json({output:[{content:[{text:JSON.stringify({approved:[],reason:'只是可选同义改写',modelRevision:''})}]}]});
  const draft='AI is good for these students.';
  const result=await f.reviewCandidateFeedback({modelRevision:draft,feedback:[{category:'语言准确性 · 词形选择',quote:'good',correction:'good → useful',why:'更正式',confidence:'中'}]},draft,'test-placeholder',new AbortController().signal);
  assert.deepEqual(result.feedback,[]);assert.equal(result.modelRevision,draft);
 }
}finally{globalThis.fetch=originalFetch;}
console.log('Service reliability regression passed: bounded retry, no quota retry, no synthetic live fallback, lexical preservation / empty-review handling.');
