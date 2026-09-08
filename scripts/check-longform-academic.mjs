import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const dataset=JSON.parse(await readFile(new URL('../benchmarks/accuracy/academic-longform-cases.json',import.meta.url),'utf8'));
assert.match(dataset.version,/^\d+\.\d+\.\d+$/,'Long-form dataset needs a semantic version');
assert.equal(dataset.labelStatus,'internal_curated_pending_independent_review','Do not present internal labels as independently reviewed');
assert.ok(Array.isArray(dataset.cases)&&dataset.cases.length>=6,'Long-form dataset needs at least six cases');
const ids=new Set();
const families=new Set(['universal','argument','thesis','cohesion']);
for(const test of dataset.cases){
  assert.ok(test.id&&!ids.has(test.id),`Duplicate or empty case id: ${test.id}`); ids.add(test.id);
  assert.ok(['scope','causality','evidence','thesis','cohesion'].includes(test.dimension),`${test.id}: invalid dimension`);
  assert.ok(['issue','clear'].includes(test.polarity),`${test.id}: invalid polarity`);
  const words=test.draft.trim().split(/\s+/).length;
  const nonWhitespace=test.draft.replace(/\s/g,'').length;
  assert.ok(words>=140,`${test.id}: needs at least 140 words`);
  assert.ok(nonWhitespace<=6000,`${test.id}: exceeds product input limit`);
  assert.ok(test.rationale?.trim().length>=40,`${test.id}: rationale is incomplete`);
  assert.equal(Boolean(test.expect)+Boolean(test.forbid),1,`${test.id}: provide exactly one target family`);
  assert.ok(families.has(test.expect||test.forbid),`${test.id}: invalid target family`);
  assert.equal(test.polarity,test.expect?'issue':'clear',`${test.id}: polarity disagrees with target`);
  if(test.maxFinalFeedback!==undefined) assert.ok(Number.isInteger(test.maxFinalFeedback)&&test.maxFinalFeedback>=0,`${test.id}: invalid final feedback limit`);
}
for(const dimension of ['scope','causality','thesis','cohesion']){
  assert.ok(dataset.cases.some(test=>test.dimension===dimension),`${dimension}: missing long-form coverage`);
}
assert.ok(dataset.cases.some(test=>test.polarity==='issue')&&dataset.cases.some(test=>test.polarity==='clear'),'Long-form set needs issue and clear controls');

if(process.env.RUN_LIVE_LONGFORM!=='1'){
  console.log(`Long-form academic dataset passed: ${dataset.cases.length} internally curated cases. Independent review is still pending.`);
  process.exit(0);
}

const base=process.env.LONGFORM_BASE_URL||'http://127.0.0.1:3014';
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use an unpublished local server.');
const selectedIds=process.env.LONGFORM_CASES?.split(',').map(value=>value.trim()).filter(Boolean);
if(selectedIds) assert.ok(selectedIds.every(id=>ids.has(id)),'Unknown long-form case');
const selected=selectedIds?dataset.cases.filter(test=>selectedIds.includes(test.id)):dataset.cases;
const intervalMs=Math.min(60000,Math.max(12000,Number(process.env.LONGFORM_INTERVAL_MS||15000)));
const family=(item)=>{
  const category=`${item.category||''}`;
  const text=`${category} ${item.quote||''} ${item.why||''} ${item.correction||''}`;
  if(/\b(?:always|never)\b.*\b(?:every|all|each)\s+(?:(?:university|college|school)\s+)?(?:learner|student|participant)(?:s|'s|s')?\b/i.test(text)||/绝对化|范围过宽|普遍断言/.test(category)) return 'universal';
  if(/论点聚焦|中心观点|中心论点|主题句/.test(category)) return 'thesis';
  if(/衔接|连贯|话题转换|主题转换/.test(category)) return 'cohesion';
  if(/论证|证据|因果/.test(category)||/caus/i.test(text)) return 'argument';
  return 'other';
};
const pass=(items,test)=>test.expect?items.some(item=>family(item)===test.expect):items.every(item=>family(item)!==test.forbid);
const results=[];
let lastRequestAt=0;
for(const test of selected){
  const waitMs=Math.max(0,lastRequestAt+intervalMs-Date.now());
  if(waitMs) await new Promise(resolve=>setTimeout(resolve,waitMs));
  lastRequestAt=Date.now();
  const response=await fetch(`${base}/api/coach`,{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:base,'x-revisioncoach-diagnostic':'stage-counts'},
    body:JSON.stringify({phase:'initial',mode:'coach',draft:test.draft}),
    signal:AbortSignal.timeout(70000),
  });
  const data=await response.json();
  const stages=data.accuracyStages;
  const evidence={id:test.id,status:response.status,data};
  if(response.status===200&&data.provider==='openai'&&stages){
    const allFinalQuotesGrounded=stages.final.every(item=>test.draft.toLocaleLowerCase().includes(`${item.quote||''}`.trim().toLocaleLowerCase()));
    const keys=stages.final.map(item=>`${family(item)}:${`${item.quote||''}`.trim().toLocaleLowerCase()}`);
    const noExactDuplicates=new Set(keys).size===keys.length;
    const finalCountAllowed=test.maxFinalFeedback===undefined||stages.final.length<=test.maxFinalFeedback;
    evidence.stageScores={generated:pass(stages.generated,test),reviewed:pass(stages.reviewed,test),final:pass(stages.final,test)&&allFinalQuotesGrounded&&noExactDuplicates&&finalCountAllowed};
    evidence.grounding={allFinalQuotesGrounded,noExactDuplicates};
  }
  results.push(evidence);
  console.log(JSON.stringify({id:test.id,status:response.status,stageScores:evidence.stageScores,grounding:evidence.grounding}));
}
const summary={evidenceMode:'live-longform-stage-trace',generatedAt:new Date().toISOString(),selectedCases:selected.length,requests:results.length,validResponses:results.filter(item=>item.stageScores).length,generatedPasses:results.filter(item=>item.stageScores?.generated).length,reviewedPasses:results.filter(item=>item.stageScores?.reviewed).length,finalPasses:results.filter(item=>item.stageScores?.final).length};
await mkdir('reports/accuracy',{recursive:true});
const reportPath=`reports/accuracy/longform-${summary.generatedAt.replace(/[:.]/g,'-')}.json`;
await writeFile(reportPath,JSON.stringify({summary,results},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
console.log(`Evidence: ${reportPath}`);
assert.equal(summary.validResponses,summary.requests,'Every request must be a real traced OpenAI response');
assert.equal(summary.generatedPasses,summary.requests,'Long-form candidate generation gate failed');
assert.equal(summary.reviewedPasses,summary.requests,'Long-form review gate failed');
assert.equal(summary.finalPasses,summary.requests,'Long-form final gate failed');
console.log('Selected long-form gate passed. This is not a general accuracy estimate.');
