import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync('app/grammar-practice/engine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = {exports:{}}; new Function('exports','module',compiled)(mod.exports,mod);
const {matchRules,selectQuestions,readHistory,addHistory,edits,checkAttempt} = mod.exports;
const bank=JSON.parse(fs.readFileSync('app/grammar-practice/bank.json','utf8'));
const feedback=(quote,corrected,category='Language accuracy')=>({quote,correction:`${quote} → ${corrected}`,category,confidence:'高'});
assert.equal(bank.length,480);
for(const q of bank) {
 assert.equal(checkAttempt(q,q.prompt),'needs-revision',q.id);
 assert.equal(checkAttempt(q,q.referenceAnswer),'reference',q.id);
 assert.equal(q.prompt.slice(0,q.target.start)+q.target.replacement+q.prompt.slice(q.target.end),q.referenceAnswer);
 assert.equal(matchRules([feedback(q.prompt,q.referenceAnswer)],[],bank)[0]?.ruleId,q.ruleId,q.id);
}
const price = bank.find(q => q.prompt === 'The price of these books are high.');
assert.equal(checkAttempt(price,'The price of these books are higher'),'needs-revision');
assert.equal(checkAttempt(price,'The prices of these books are high.'),'review');
assert.equal(checkAttempt(price,'These books have a high price.'),'review');
assert.equal(checkAttempt(price,'The price of these books is higher.'),'review');
assert.equal(checkAttempt(price,' The price of these books is high '),'reference');
const scenarios=[
 ['Both pupils is ready.','Both pupils are ready.','agreement.present-be'],
 ['The pupils was ready.','The pupils were ready.','agreement.past-be'],
 ['This bicycle have lights.','This bicycle has lights.','agreement.have-agreement'],
 ['She should writes clearly.','She should write clearly.','auxiliaries.should-base'],
 ['They will goes home.','They will go home.','auxiliaries.will-would-base'],
 ['They did went home.','They did go home.','auxiliaries.did-base'],
 ['We need learn today.','We need to learn today.','complements.need-to'],
 ['She reads careful.','She reads carefully.','word-forms.adverb-manner'],
 ['They asked themself why.','They asked themselves why.','pronouns.reflexive'],
 ['We saw three student.','We saw three students.','nouns.number-plural'],
 ['Many researcher agreed.','Many researchers agreed.','nouns.plural-quantifier'],
 ['This is a unusual idea.','This is an unusual idea.','articles.an-vowel'],
 ['Wait for a hour.','Wait for an hour.','articles.silent-h'],
 ['It is an useful device.','It is a useful device.','articles.consonant-sound-vowel-letter'],
 ['There is three options.','There are three options.','agreement.existential-be'],
];
for(const [a,b,rule] of scenarios) assert.equal(matchRules([feedback(a,b)],[],bank)[0]?.ruleId,rule,a);
assert.deepEqual(matchRules([feedback('AI helps everyone.','AI may help some people.','Academic guidance')],[],bank),[]);
assert.deepEqual(matchRules([feedback('It works and we agree.','It works, and we agree.')],[],bank),[]);
assert.deepEqual(matchRules([{category:'Language accuracy',quote:'Unknown problem.',correction:'Think again.'}],[],bank),[]);
assert.deepEqual(matchRules([{...feedback('Both pupils is ready.','Both pupils are ready.'),confidence:'低'}],[],bank),[]);
assert.deepEqual(matchRules([{category:'Language accuracy',quote:'A good sentence.',correction:'is → are'}],[],bank),[]);
assert.deepEqual(matchRules([{category:'Language accuracy',quote:'This works.',why:'“is” → “are”'}],[],bank),[]);
assert.deepEqual(readHistory('bad json'),[]); assert.deepEqual(readHistory('{"x":3}'),[]);
const partial=matchRules([feedback('Both pupils is ready.','Both pupils are ready.')],[feedback('She reads careful.','She reads carefully.')],bank);
assert.equal(partial[0].source,'recheck'); assert.equal(partial[1].source,'initial');
const quoted=matchRules([{category:'语言准确性',quote:'Both pupils is reading careful.',why:'本句实际修改：“is” → “are”；“careful” → “carefully”。'}],[],bank);
assert.deepEqual(quoted.map(x=>x.ruleId),['agreement.present-be','word-forms.adverb-manner']);
let history=[];
for(let round=0;round<30;round++) {
 const selected=selectQuestions(bank,partial,history,()=>.3);
 assert.equal(selected.length,3); assert.equal(new Set(selected.map(x=>x.id)).size,3);
 assert.ok(selected.every(x=>partial.some(m=>m.ruleId===x.ruleId)));
 history=addHistory(history,selected.map(x=>x.id));
}
const one=matchRules([feedback('Both pupils is ready.','Both pupils are ready.')],[],bank);
const first=selectQuestions(bank,one,[],()=>0);
const second=selectQuestions(bank,one,first.map(x=>x.id),()=>0);
assert.ok(!first.some(x=>second.slice(0,2).some(y=>y.id===x.id)),'unseen questions before recycling');
const spelling=bank.find(q=>q.ruleId.startsWith('spelling.'));
const sp=selectQuestions(bank,matchRules([feedback(spelling.prompt,spelling.referenceAnswer)],[],bank),[],()=>0);
assert.ok(sp.every(q=>q.target.original===spelling.target.original),'spelling must use same word');
assert.deepEqual(selectQuestions(bank,[],[],()=>0),[]);
assert.deepEqual(edits('Many students is reading careful.','Many students are reading carefully.'),[['is','are'],['careful','carefully']]);
console.log('PASS: 480 source/reference fixtures; 15 unseen-context mappings; exclusion, partial revision, history, uniqueness and spelling constraints. No AI requests.');
