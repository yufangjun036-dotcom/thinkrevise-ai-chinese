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
  {
    id:'peer-register-boundary',
    draft:'We looked at how the drug works in liver cells. The thing we found is that low dose can slow down cell aging. Lots of earlier studies also got similar results. We think this finding is pretty useful. It tells us that natural compounds may help protect cells from damage. We will do more tests later to check if this idea holds.',
    expected:['low dose','The thing we found','Lots of','got similar results','pretty useful','check if this idea holds'],
    languageCount:1,
    academicCount:5,
    forbidden:['looked at','tells us'],
  },
  {
    id:'peer-register-optional-clean',
    draft:'We looked at how the drug works in liver cells, and the resulting measurements tell us which concentrations warrant further investigation.',
    expected:[],
  },
  {
    id:'peer-corrected-grammar-overclaim-remains',
    draft:'The experiment shows that temperature affects the growth rate of algae. We collected data last week, but one sensor was broken. This result is important because it proves climate change will influence aquatic ecosystems. Many factors can change the outcome. When the water is too hot, algae stop growing fast. We plan to repeat the test next month to verify our conclusion.',
    expected:['proves climate change will influence aquatic ecosystems'],
    languageCount:0,
    academicCount:1,
  },
  {
    id:'peer-ai-course-reflection',
    draft:'I take this course about AI in education this semester, and it change my mind a lot. Before, I just think AI is only for chat and write homework quickly. But after many class discussion, I know AI is not a simple tool to finish assignment.\n\nIn class, we talk about how teacher can use AI to make different exercise for student. Some student learn slow, some learn fast, AI can give them different material. But I also find a big problem: if student depend too much on AI, they will lose the ability to think by themself. Many people just copy AI answer without reading, this make learning no meaning.\n\nI try to use AI to help me prepare lesson plan in our project. It save a lot time, but AI sometimes give wrong information. I need check every point carefully, can not trust all things it say. This is the most important thing I learn.\n\nAI will not replace teachers. Teacher can see student’s emotion, encourage them and guide their thinking. AI only help. In future, I want learn more to use AI wisely, not overuse it. We should control AI, not let AI control our study.',
    expected:[
      'it change', 'Before, I just think', 'for chat and write homework', 'many class discussion', 'finish assignment',
      'teacher can use AI to make different exercise for student', 'Some student learn slow, some learn fast, AI can',
      'if student depend too much on AI', 'by themself',
      'Many people just copy AI answer without reading, this make learning no meaning', 'prepare lesson plan',
      'It save', 'a lot time', 'AI sometimes give',
      'I need check every point carefully, can not trust all things it say',
      'Teacher can see student’s emotion', 'AI only help', 'This is the most important thing I learn', 'I want learn', 'AI will not replace teachers.',
    ],
    languageCount:19,
    academicCount:1,
    forbidden:['different material','In future','I take this course','we talk about','I try to use AI'],
  },
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
    if(Number.isInteger(test.languageCount)) assert.equal(data.feedback.filter(item=>item.category.startsWith('语言准确性')).length,test.languageCount,'Unexpected objective-language count');
    if(Number.isInteger(test.academicCount)) assert.equal(data.feedback.filter(item=>item.category.startsWith('学术建议')).length,test.academicCount,'Unexpected academic-advice count');
    for (const forbidden of test.forbidden ?? []) assert.ok(!data.feedback.some(item=>item.quote.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase())),`Optional expression was over-reported: ${forbidden}`);
  } catch(e) {failures++;evidence.error=e.message;console.error(test.id,e.message);}
}
await mkdir('reports/accuracy',{recursive:true});
const reportPath=`reports/accuracy/boundaries-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
await writeFile(reportPath,JSON.stringify({evidenceMode:'live',failures,results},null,2)+'\n');
console.log(`Evidence: ${reportPath}`);
assert.equal(failures,0,'Real accuracy boundary cases failed; do not release');
console.log(`${selected.length} bounded live accuracy cases passed. Not a general accuracy estimate.`);
