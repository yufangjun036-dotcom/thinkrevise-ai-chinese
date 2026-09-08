import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const dataset=JSON.parse(await readFile(new URL('../benchmarks/accuracy/academic-stability-cases.json',import.meta.url),'utf8'));
assert.match(dataset.version,/^\d+\.\d+\.\d+$/,'Academic stability dataset needs a semantic version');
assert.equal(dataset.labelStatus,'internal_curated_pending_independent_review','Do not present internal labels as independently reviewed');
assert.ok(Array.isArray(dataset.cases)&&dataset.cases.length>=15,'Academic stability dataset needs at least 15 cases');
const ids=new Set();
const allowedFamilies=new Set(['universal','argument','thesis','cohesion']);
for(const test of dataset.cases){
  assert.ok(test.id&&!ids.has(test.id),`Duplicate or empty case id: ${test.id}`); ids.add(test.id);
  assert.ok(['scope','causality','thesis','cohesion','evidence'].includes(test.dimension),`${test.id}: invalid dimension`);
  assert.ok(['issue','clear'].includes(test.polarity),`${test.id}: invalid polarity`);
  assert.ok(test.draft?.trim().length>=40&&test.rationale?.trim().length>=20,`${test.id}: draft or rationale is incomplete`);
  assert.equal(Boolean(test.expect)+Boolean(test.forbid),1,`${test.id}: provide exactly one expected or forbidden family`);
  assert.ok(allowedFamilies.has(test.expect||test.forbid),`${test.id}: invalid family`);
  assert.equal(test.polarity,test.expect?'issue':'clear',`${test.id}: polarity disagrees with label`);
  if(test.maxFinalFeedback!==undefined) assert.ok(Number.isInteger(test.maxFinalFeedback)&&test.maxFinalFeedback>=0,`${test.id}: invalid final feedback maximum`);
}
for(const dimension of ['scope','causality','thesis','cohesion','evidence']){
  const members=dataset.cases.filter(test=>test.dimension===dimension);
  assert.ok(members.some(test=>test.polarity==='issue')&&members.some(test=>test.polarity==='clear'),`${dimension}: needs an issue/clear pair`);
}
if(process.env.RUN_LIVE_STABILITY!=='1'){
  console.log(`Academic stability dataset passed: ${dataset.cases.length} internally curated cases. Independent review is still pending.`);
  process.exit(0);
}
const base=process.env.STABILITY_BASE_URL||'http://127.0.0.1:3014';
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use an unpublished local server.');
const repeats=Math.min(5,Math.max(1,Number(process.env.STABILITY_REPEATS||2)));
const intervalMs=Math.min(60000,Math.max(12000,Number(process.env.STABILITY_INTERVAL_MS||15000)));

const cases=dataset.cases;

const selectedIds=process.env.STABILITY_CASES?.split(',').filter(Boolean);
if(selectedIds) assert.ok(selectedIds.every(id=>cases.some(test=>test.id===id)),'Unknown stability case');
const selected=selectedIds?cases.filter(test=>selectedIds.includes(test.id)):cases;
const family=(item)=>{
  const category=`${item.category||''}`;
  const text=`${item.category||''} ${item.quote||''} ${item.why||''} ${item.correction||''}`;
  if(/\b(?:always|never)\b.*\b(?:every|all|each)\s+(?:learner|student|participant)s?\b/i.test(text)||/绝对化|范围过宽|普遍断言/.test(category)) return 'universal';
  if(/论点聚焦|中心观点|中心论点|主题句/.test(category)) return 'thesis';
  if(/衔接|连贯|话题转换|主题转换/.test(category)) return 'cohesion';
  if(/论证|证据|因果/.test(category)||/caus/i.test(text)) return 'argument';
  return 'other';
};
const stagePass=(items,test)=>test.expect
  ? items.some(item=>family(item)===test.expect)
  : test.forbid
    ? items.every(item=>family(item)!==test.forbid)
    : items.length===0;
const finalPass=(items,test)=>stagePass(items,test)
  &&(test.maxFinalFeedback===undefined||items.length<=test.maxFinalFeedback);
const results=[];
let lastRequestAt=0;
for(let run=1;run<=repeats;run++){
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
    const evidence={id:test.id,run,expect:test.expect||null,forbid:test.forbid||null,status:response.status,data};
    if(response.status===200&&data.provider==='openai'&&stages){
      evidence.stageScores={
        generated:stagePass(stages.generated,test),
        reviewed:stagePass(stages.reviewed,test),
        final:finalPass(stages.final,test),
      };
    }
    results.push(evidence);
    console.log(JSON.stringify({id:test.id,run,status:response.status,counts:stages&&Object.fromEntries(Object.entries(stages).map(([key,value])=>[key,value.length])),stageScores:evidence.stageScores}));
  }
}
const summary={
  evidenceMode:'live-stage-trace',
  generatedAt:new Date().toISOString(),
  repeats,
  selectedCases:selected.length,
  requests:results.length,
  validResponses:results.filter(item=>item.stageScores).length,
  generatedPasses:results.filter(item=>item.stageScores?.generated).length,
  reviewedPasses:results.filter(item=>item.stageScores?.reviewed).length,
  finalPasses:results.filter(item=>item.stageScores?.final).length,
};
await mkdir('reports/accuracy',{recursive:true});
const reportPath=`reports/accuracy/stability-${summary.generatedAt.replace(/[:.]/g,'-')}.json`;
await writeFile(reportPath,JSON.stringify({summary,results},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
console.log(`Evidence: ${reportPath}`);
assert.equal(summary.validResponses,summary.requests,'Every request must be a real traced OpenAI response');
assert.equal(summary.generatedPasses,summary.requests,'Candidate generation stability gate failed');
assert.equal(summary.reviewedPasses,summary.requests,'Independent review stability gate failed');
assert.equal(summary.finalPasses,summary.requests,'Final academic stability gate failed');
console.log('Selected academic stability gate passed. This is not a general accuracy estimate.');
