// Explicit opt-in: two local-server live calls, no automatic retries or credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
if (process.env.RUN_LIVE_INCIDENT !== '1') throw new Error('Requires RUN_LIVE_INCIDENT=1; this uses paid AI.');
const base = process.env.INCIDENT_BASE_URL || 'http://127.0.0.1:3014';
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use a local server to validate unpublished changes.');
const original = 'Nowadays, AI is really good for university students. It gives a lot of feedback and students can finish work fast. For example, a student can ask a chatbot to improve an essay in a few seconds. But sometimes students just use the answer and do not think about whether it is correct. They may also accept invented information. Many students is using AI without checking the answer careful, and teh feedback can be confusing. I think universities should teach students how to evaluate AI feedback because it is important. This teaching can help students use technology in a responsible way and still develop their own judgement.';
async function post(body) {
  const response = await fetch(`${base}/api/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const data = await response.json();
  console.log(JSON.stringify({phase: body.phase, status: response.status, data}));
  assert.equal(response.status, 200);
  assert.equal(data.provider, 'openai', 'Demo fallback is not a live pass');
  return data;
}
const initial = process.env.RESUME_INCIDENT === '1'
  ? JSON.parse(readFileSync(new URL('./live-incident-initial-2026-09-08.json', import.meta.url), 'utf8'))
  : await post({phase: 'initial', mode: 'coach', draft: original});
assert.equal(initial.provider, 'openai');
const revised = original.replace('students is', 'students are');
const priorFeedback = initial.feedback.map(({category, quote, why, correction, confidence}) => ({category, quote, why, correction, confidence}));
const second = await post({phase: 'revision', mode: 'coach', draft: revised, originalDraft: original, priorFeedback});
assert.ok(!second.feedback.some(item => /主谓一致/.test(item.category)), 'Correct agreement flagged');
assert.ok(second.feedback.some(item => item.quote.includes('careful')), 'Unchanged word-form error missing');
assert.ok(second.feedback.some(item => item.quote === 'teh'), 'Unchanged spelling error missing');
assert.equal(second.revisionComparison.changedCount,0,'An unrelated unchanged passage was classified as edited');
assert.equal(second.revisionComparison.resolved.length,1,'Only the agreement edit should clear an original finding');
assert.equal(second.revisionComparison.resolved[0].quote,'students is');
assert.ok(!second.feedback.some(item=>/词性|词形/.test(item.category) && /a lot of feedback/.test(item.quote)),'Valid quantity phrase misclassified');
assert.ok(!/\bteh\b|students is|answer careful\b/.test(second.modelRevision),'Final text still contains a diagnosed error');
assert.ok(!second.feedback.some(item=>/^can help\s*→\s*may help/.test(item.correction)),'Pure modal preference should not be a finding');
console.log('Basic live checks passed; manual review of all returned findings is still required.');
