// Exercise the actual route functions offline: no API key or network involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let source = fs.readFileSync(new URL('../app/api/coach/route.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
source += '\nexport { validateLiveResult, ensureMinorRevisionConsistency, addRevisionComparison, explicitlySaysNoIssue };';
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} };
new Function('exports', 'require', 'module', compiled)(sandbox.exports, require, sandbox);
const f = sandbox.exports;
const issue = (quote, correction, category = '主谓一致') => ({ quote, correction, category, why: '需要检查。', suggestion: '', confidence: '高' });
const result = (feedback, draft) => ({ summary: '测试', feedback, modelRevision: draft, overview: [], meaningRisk: '' });
const original = 'Many students is using AI to review their writing. They notice teh feedback.';
const revised = original.replace('students is', 'students are');
const prior = [issue('students is', 'students is → students are'), issue('teh', 'teh → the', '拼写错误')];
let checks = 0;
function compare(draft, feedback, baseline = original, previous = prior) {
  const live = f.validateLiveResult(result(feedback, draft), draft, 'coach', 0, true);
  const output = f.addRevisionComparison(f.ensureMinorRevisionConsistency(live, draft, baseline, previous), draft, baseline, previous);
  const c = output.revisionComparison;
  assert.equal(c.remainingCount + c.changedCount + c.supplementalCount, output.feedback.length);
  assert.ok(output.feedback.every(item => draft.includes(item.quote)));
  checks++;
  return output;
}
for (const verdict of ['无；此处已正确。', '无需修改', '没有错误', 'No correction needed', 'Already correct.']) {
  const output = compare(revised, [issue('students are using AI', verdict)]);
  assert.ok(!output.feedback.some(item => item.quote.includes('students are')));
  assert.equal(output.revisionComparison.changedCount, 0);
  assert.ok(output.feedback.some(item => item.quote === 'teh'));
}
assert.equal(f.explicitlySaysNoIssue({ ...issue('word', '改为正确形式'), why: '语法正确，但仍有拼写错误。' }), false);
for (const mode of ['coach', 'model', 'rewrite']) {
  const validated = f.validateLiveResult(result([issue('students are using AI', '无；此处已正确。')], revised), revised, mode, 0, true);
  assert.ok(!validated.feedback.some(item => item.quote === 'students are using AI'));
}
assert.equal(compare(original, []).revisionComparison.remainingCount, 2);
assert.equal(compare(original + ' c', []).revisionComparison.remainingCount, 2);
const stillWrong = original.replace('students is', 'students was');
const wrongOutput = compare(stillWrong, [issue('students was', 'students was → students were')]);
assert.ok(!wrongOutput.revisionComparison.resolved.some(item => item.quote === 'students is'));
assert.ok(wrongOutput.feedback.some(item => item.revisionStatus === 'changed'));
const longWrong = compare(stillWrong, [issue('students was using AI to review their writing', 'students was → students were')]);
assert.ok(!longWrong.revisionComparison.resolved.some(item => item.quote === 'students is'));
assert.ok(longWrong.feedback.some(item => item.revisionStatus === 'changed'));
const added = compare(revised + ' People is waiting.', [issue('People is', 'People is → People are')]);
assert.ok(added.feedback.some(item => item.quote === 'People is' && item.revisionStatus === 'changed'));
const contextual = compare('The student is using AI.', [], 'The students is using AI.', [issue('is using AI', 'Use a plural verb')]);
assert.equal(contextual.feedback.length, 0);
const clean = compare(revised.replace('teh', 'the'), []);
assert.equal(clean.feedback.length, 0);
const discourse = issue('students is', '需要补充证据。', '论证');
assert.ok(compare(original + ' c', [], original, [discourse]).feedback.some(item => item.category === '论证'));
const withEvidence = compare(original + ' A controlled comparison explains the reason.', [], original, [discourse]);
assert.ok(!withEvidence.feedback.some(item => item.category === '论证'));
const manyDraft = Array.from({ length: 45 }, (_, i) => `Token${i}`).join(' ');
const many = Array.from({ length: 45 }, (_, i) => issue(`Token${i}`, '需要补充论据。', '论证'));
const limited = f.addRevisionComparison(result([...many, many[0]], manyDraft), manyDraft, '', []);
assert.equal(limited.feedback.length, 36);
assert.equal(limited.revisionComparison.changedCount, 36);
console.log(`Revision regression passed: ${checks} pipeline cases, verdict negatives, duplicate/cap accounting. No network or API usage.`);
