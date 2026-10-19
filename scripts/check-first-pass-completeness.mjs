import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nexport {spellingReplacement,findLanguageIssues,languageReviewSentences,normaliseFeedbackCategory,addRevisionComparison};';
const box={};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box);
for(const [draft,expected] of [['teh system works.','The'],['We checked it. teh system works.','The'],['We use teh system.','the'],['TEH system works.','THE'],['We asked Dr. teh about it.','the']]){
 const item=box.findLanguageIssues(draft).find(x=>/^teh$/i.test(x.quote));assert.ok(item);assert.ok(item.correction.startsWith(`${item.quote} → ${expected}。`),item.correction);
}
delete process.env.SENTENCE_LANGUAGE_REVIEW;
assert.equal(box.languageReviewSentences('People is unsure.').length,1);
assert.equal(box.normaliseFeedbackCategory({category:'语言准确性 · 句子连接与标点',quote:'the system works.',correction:'the system works. → The system works.'}).category,'语言准确性 · 拼写与大小写');
assert.equal(box.findLanguageIssues('We use teh tool. teh system works.').filter(x=>x.quote==='teh').length,2);
console.log('First-pass completeness: contextual spelling, short drafts, capitalization classification and repeated occurrences passed.');
assert.equal(box.normaliseFeedbackCategory({category:'语言准确性 · 句子连接与标点',quote:'teh system works.',correction:'teh system works. → The system works.'}).category,'语言准确性 · 拼写与大小写');
assert.equal(box.normaliseFeedbackCategory({category:'语言准确性 · 综合语言修改',quote:'teh system work.',correction:'teh system work. → The system works.'}).category,'语言准确性 · 综合语言修改');
const original='teh system can give useful feedback.';
const corrected='The system can give useful feedback.';
const old={category:'语言准确性 · 拼写与大小写',quote:original,why:'Fix spelling and sentence-initial case.',correction:original+' → '+corrected,confidence:'高'};
const comparison=box.addRevisionComparison({feedback:[]},corrected,original,[old]).revisionComparison;
assert.equal(comparison.initialCount,1,'A valid sentence-level spelling suggestion must remain in the first-round total');
assert.equal(comparison.resolved.length,1);
