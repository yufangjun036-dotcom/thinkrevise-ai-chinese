import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../app/api/coach/route.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "") + "\nexport { normaliseFeedbackCategory, validateLiveResult };";
const box = {exports:{}};
new Function("exports","require","module",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box.exports,require,box);
const f=box.exports;
const base={category:"语言准确性 · 句子完整性",quote:"AI help students.",why:"句子不完整，缺少谓语",correction:"help → helps",suggestion:"",confidence:"高"};
const fixed=f.normaliseFeedbackCategory(base);
assert.equal(fixed.category,"语言准确性 · 主谓一致");
assert.match(fixed.why,/第三人称单数/);
assert.doesNotMatch(fixed.why,/缺少谓语/);
for(const [quote,correction] of [["It need help.","need → needs"],["She work here.","work → works"]]){
 assert.equal(f.normaliseFeedbackCategory({...base,quote,correction}).category,"语言准确性 · 主谓一致");
}
for(const [quote,correction] of [["AI tools help students.","tool → tools"],["It helped students.","helped → helps"],["Because AI helps students.","help → helps"]]){
 assert.equal(f.normaliseFeedbackCategory({...base,quote,correction}).why,base.why);
}
const academic={...base,category:"学术建议 · 论证与证据",quote:"Every school should replace all teachers with AI.",why:"无证据支持普遍政策",correction:"Every school should replace all teachers with AI. → Schools should not replace teachers with AI."};
assert.doesNotMatch(f.normaliseFeedbackCategory(academic).correction,/should not/);
assert.match(f.normaliseFeedbackCategory(academic).correction,/保留作者/);
assert.equal(f.normaliseFeedbackCategory(academic).why,academic.why);
const bounded={...academic,correction:"Every school should replace all teachers with AI. → Schools could consider AI for selected tasks."};
assert.equal(f.normaliseFeedbackCategory(bounded).correction,bounded.correction);
const reverse={...academic,quote:"Schools should not use AI.",correction:"Schools should not use AI. → Schools should use AI."};
assert.match(f.normaliseFeedbackCategory(reverse).correction,/保留作者/);
const result=f.validateLiveResult({summary:"",feedback:[base],overview:[],meaningRisk:"",modelRevision:""},base.quote,"coach",0,false,false);
assert.ok(result.feedback.some(x=>x.category==="语言准确性 · 主谓一致"));
console.log("Feedback fidelity: agreement explanation, boundary controls, stance reversal in both directions, and retained diagnosis passed.");
