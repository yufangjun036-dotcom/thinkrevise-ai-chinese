import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
if (process.env.RUN_LIVE_INCIDENT !== '1') throw new Error('Paid test requires opt-in.');
const base='http://127.0.0.1:3014';
const cases=[
  {id:'clean-argument', draft:'The study compared two teaching methods in one undergraduate course. Students completed the same assessment before and after instruction. Scores increased in both groups, but the small sample limits generalisation. These findings suggest that further research is needed before either method can be recommended for other settings.', expected:[]},
  {id:'clean-limitation', draft:'The algorithm returns just one result for each query. In this experiment, the particles move fast enough to reach the detector within one second. We measured their speed using a calibrated sensor. These observations describe the experimental conditions, not the efficiency of the algorithm.', expected:[]},
  {id:'three-errors', draft:'Many students is checking the results careful. They noticed teh difference between the two groups.', expected:['students is','careful','teh']},
  {id:'clean-progressive', draft:'Students are relying on several independent sources to evaluate the claim.', expected:[]},
  {id:'clean-gerund', draft:'Relying on a single source can introduce bias.', expected:[]},
  {id:'clean-question', draft:'Does it help students evaluate evidence?', expected:[]},
  {id:'clean-modal-question', draft:'How can it improve the quality of the analysis?', expected:[]},
  {id:'clean-number-agreement', draft:'The number of students is increasing steadily.', expected:[]},
  {id:'clean-logical-always', draft:'Every square has four sides. A square therefore always has four vertices.', expected:[]},
  {id:'unsupported-universal', draft:"This tutoring method always improves every learner's performance.", expected:['always'], academic:true},
];
let failures=0;
const results=[];
let lastRequestAt=0;
const selectedIds=process.env.BOUNDARY_CASES?.split(',').filter(Boolean);
if(selectedIds) assert.ok(selectedIds.every(id=>cases.some(test=>test.id===id)), 'Unknown boundary case');
const selected=selectedIds?cases.filter(test=>selectedIds.includes(test.id)):cases;
for (const test of selected) {
  const waitMs=Math.max(0,lastRequestAt+15000-Date.now());
  if(waitMs) await new Promise(resolve=>setTimeout(resolve,waitMs));
  lastRequestAt=Date.now();
  const r=await fetch(base+'/api/coach',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({draft:test.draft,mode:'coach',phase:'initial'}),signal:AbortSignal.timeout(70000)});
  const data=await r.json();
  const evidence={id:test.id,draft:test.draft,status:r.status,data};
  results.push(evidence);
  console.log(JSON.stringify({id:test.id,status:r.status,data}));
  try {
    assert.equal(r.status,200); assert.equal(data.provider,'openai');
    if (!test.expected.length) assert.equal(data.feedback.length,0,'Clean control received unsupported feedback');
    else {
      assert.equal(data.feedback.length,test.expected.length,'Only the expected findings');
      for (const quote of test.expected) assert.ok(data.feedback.some(item=>item.quote.includes(quote)),quote);
      if(test.academic) assert.ok(data.feedback.every(item=>item.category.startsWith('学术建议')),'Empirical claim advice is not a grammar error');
    }
  } catch(e) {failures++;evidence.error=e.message;console.error(test.id,e.message);}
}
await mkdir('reports/accuracy',{recursive:true});
const reportPath=`reports/accuracy/boundaries-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
await writeFile(reportPath,JSON.stringify({evidenceMode:'live',failures,results},null,2)+'\n');
console.log(`Evidence: ${reportPath}`);
assert.equal(failures,0,'Real accuracy boundary cases failed; do not release');
console.log(`${selected.length} bounded live accuracy cases passed. Not a general accuracy estimate.`);
