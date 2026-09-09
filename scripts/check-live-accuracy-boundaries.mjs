import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
if (process.env.RUN_LIVE_INCIDENT !== '1') throw new Error('Paid test requires opt-in.');
const base=process.env.THINKREVISE_BASE_URL || 'http://127.0.0.1:3014';
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
  {
    id:'blind-2', atLeast:true,
    draft:'AI change the way we study. I use ChatGPT last month to finish my essay, and it help me write paragraph very fast. But my professor say many student just paste AI text and skip thinking. When I submit my first draft, my teacher tell me my idea is shallow. I find AI sometimes make fake reference, the source not exist at all. I think student should know AI can lie. We can use AI for brainstorm, but cannot let it write whole paper.',
    expected:['AI change the way','I use ChatGPT last month','it help me write paragraph','my professor say','many student','my teacher tell me','I find AI sometimes make fake reference, the source not exist at all','student should know','for brainstorm'],
    minimumLanguageCount:9, academicCount:0,
  },
  {
    id:'blind-3', atLeast:true,
    draft:'Many school start to use AI tutor in classroom. AI tutor can give quiz to student, and mark answer automatic. But there is a big risk: AI cannot notice student emotion. When student feel upset or confuse, AI will not comfort them. Last week, my classmate use AI to practice math. The AI give wrong answer for one hard question, and my class waste many time follow the wrong step. I believe AI can assist teaching, but human teacher still necessary.',
    expected:['Many school start','use AI tutor in classroom','give quiz to student','mark answer automatic','student emotion','When student feel upset or confuse','my classmate use AI to practice math','The AI give wrong answer','my class waste many time follow the wrong step','human teacher still necessary'],
    minimumLanguageCount:10, academicCount:0,
  },
  {
    id:'blind-4', atLeast:true,
    draft:'Some people argue AI will replace teacher in 10 year. I disagree this opinion. AI can only process data, it cannot understand personal story of each student. When I was in high school, my English teacher help me build confidence. No AI can do that. Also, AI training data have bias. If we only rely on AI, student may receive unfair information. We should set rule to limit overuse of AI in school.',
    expected:['replace teacher in 10 year','I disagree this opinion','AI can only process data, it cannot understand','personal story of each student','my English teacher help me','student may receive','set rule to limit'],
    minimumLanguageCount:7, academicCount:0,
    forbidden:['AI training data have bias'],
  },
  {
    id:'blind-5', atLeast:true,
    draft:'AI help teacher reduce boring work, like grade homework and make worksheet. But many student use AI to cheat on exam. Last semester, our school catch three student who copy AI answer during online quiz. The punishment is warning. I think school need clear rule about AI. Student must learn what is allowed and what is not. If student use AI properly, it become a good helper.',
    expected:['AI help teacher reduce boring work','like grade homework and make worksheet','many student','cheat on exam','our school catch three student who copy AI answer','The punishment is warning','school need clear rule about AI','Student must learn','If student use AI properly, it become'],
    minimumLanguageCount:9, academicCount:0,
  },
  {
    id:'blind-6', atLeast:true,
    draft:'Learning with AI have both advantage and risk. AI can give instant feedback when student finish exercise. This save waiting time. But feedback from AI sometimes too simple, it cannot explain deep logic. When I practice writing, AI tell me my sentence is wrong, but not explain why. I think AI work best when student already have basic knowledge, and use AI to check mistake.',
    expected:['Learning with AI have both advantage and risk','when student finish exercise','This save waiting time','feedback from AI sometimes too simple, it cannot explain deep logic','AI tell me','but not explain why','AI work best','when student already have basic knowledge','check mistake'],
    minimumLanguageCount:9, academicCount:0,
  },
  {
    id:'blind-7', atLeast:true,
    draft:'Many research prove AI improve student test score. I read a paper online: 80% student get higher score after using AI study tool. But the paper not list sample size, and no reference. I try AI tool to practice vocabulary, and my score raise 15 point in one month. So AI is good for all student.',
    expected:['Many research prove','AI improve student test score','80% student get higher score','using AI study tool','the paper not list','my score raise 15 point','all student'],
    minimumLanguageCount:7, minimumAcademicCount:1,
    requiredAcademicQuotes:['80% student get higher score'],
  },
  {
    id:'blind-8', atLeast:true,
    draft:'Teacher need learn how to use AI before bring it to classroom. If teacher do not understand AI limit, they will give wrong guide to student. Last term, our teacher use AI make worksheet, and AI put wrong math formula inside. Many student finish homework based on that wrong content. After that incident, our school hold workshop to teach teacher AI basic knowledge.',
    expected:['Teacher need learn','before bring it to classroom','teacher do not understand AI limit','wrong guide to student','our teacher use AI make worksheet','Many student','our school hold workshop','teach teacher AI basic knowledge'],
    minimumLanguageCount:8, academicCount:0,
  },
  {
    id:'blind-9', atLeast:true,
    draft:'AI can help student build self-learning skill. Student can ask AI question anytime, even at night. But AI can not judge whether student really understand the concept. Some student just ask AI give answer directly, and skip thinking process. I think school should teach digital literacy class, so student know how to use AI as learning partner, not answer machine.',
    expected:['help student build self-learning skill','Student can ask AI question','AI can not judge whether student really understand','Some student just ask AI give answer directly, and skip thinking process','school should teach digital literacy class, so student know','as learning partner, not answer machine'],
    minimumLanguageCount:6, academicCount:0,
  },
  {
    id:'blind-10', atLeast:true,
    draft:'AI technology in education grow very fast. A famous research say AI can cut student study time by 40%. The researcher claim this experiment test 2000 student, but I cannot find the original paper anywhere. When I use AI for my language study, my reading speed improve a lot. Therefore, all school should buy expensive AI learning system immediately.',
    expected:['AI technology in education grow','A famous research say','cut student study time','The researcher claim this experiment test 2000 student','my reading speed improve a lot','all school should buy expensive AI learning system'],
    minimumLanguageCount:6, minimumAcademicCount:1,
    requiredAcademicQuotes:['cannot find the original paper'],
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
  const r=await fetch(base+'/api/coach',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(process.env.ACCURACY_DIAGNOSTICS==='1'?{'x-revisioncoach-diagnostic':'stage-counts'}:{})},body:JSON.stringify({draft:test.draft,mode:'coach',phase:'initial'}),signal:AbortSignal.timeout(70000)});
  const data=await r.json();
  const evidence={id:test.id,draft:test.draft,status:r.status,data};
  results.push(evidence);
  console.log(JSON.stringify({id:test.id,status:r.status,data}));
  try {
    assert.equal(r.status,200); assert.equal(data.provider,'openai');
    if (!test.expected.length) assert.equal(data.feedback.length,0,'Clean control received unsupported feedback');
    else {
      if(test.atLeast) assert.ok(data.feedback.length>=test.expected.length,'Expected findings were missing');
      else assert.equal(data.feedback.length,test.expected.length,'Only the expected findings');
      for (const quote of test.expected) assert.ok(data.feedback.some(item=>item.quote.includes(quote)||quote.includes(item.quote)),quote);
      if(test.academic) assert.ok(data.feedback.every(item=>item.category.startsWith('学术建议')),'Empirical claim advice is not a grammar error');
    }
    if(Number.isInteger(test.languageCount)) assert.equal(data.feedback.filter(item=>item.category.startsWith('语言')).length,test.languageCount,'Unexpected objective-language count');
    if(Number.isInteger(test.minimumLanguageCount)) assert.ok(data.feedback.filter(item=>item.category.startsWith('语言')).length>=test.minimumLanguageCount,'Too few objective-language findings');
    if(Number.isInteger(test.academicCount)) assert.equal(data.feedback.filter(item=>item.category.startsWith('学术建议')).length,test.academicCount,'Unexpected academic-advice count');
    if(Number.isInteger(test.minimumAcademicCount)) assert.ok(data.feedback.filter(item=>item.category.startsWith('学术建议')).length>=test.minimumAcademicCount,'Serious academic issue was missed');
    for (const quote of test.requiredAcademicQuotes ?? []) assert.ok(data.feedback.some(item=>item.category.startsWith('学术建议')&&item.quote.includes(quote)),`Serious academic evidence issue was missed: ${quote}`);
    for (const forbidden of test.forbidden ?? []) assert.ok(!data.feedback.some(item=>item.quote.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase())),`Optional expression was over-reported: ${forbidden}`);
  } catch(e) {failures++;evidence.error=e.message;console.error(test.id,e.message);}
}
await mkdir('reports/accuracy',{recursive:true});
const reportPath=`reports/accuracy/boundaries-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
await writeFile(reportPath,JSON.stringify({evidenceMode:'live',failures,results},null,2)+'\n');
console.log(`Evidence: ${reportPath}`);
assert.equal(failures,0,'Real accuracy boundary cases failed; do not release');
console.log(`${selected.length} bounded live accuracy cases passed. Not a general accuracy estimate.`);
