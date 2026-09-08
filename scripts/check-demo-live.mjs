import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const sets = [
  ['evaluate', 'privacy', 'improve', 'therefore', 'support', 'responsible', 'limitation', 'independent'],
  ['evidence', 'access', 'engage', 'however', 'participation', 'impact', 'privacy', 'independent'],
];
let previousDraft = '';
for (const words of sets) {
  const response = await fetch(`${base}/api/demo-draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: '大学应该如何教学生批判性判断 AI 反馈？', words, previousDraft }) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.provider, 'openai');
  assert.ok(data.draft !== previousDraft);
  assert.ok(data.draft.split(/\s+/).length >= 80 && data.draft.split(/\s+/).length <= 150);
  for (const word of words) assert.match(data.draft, new RegExp(`\\b${word}\\b`, 'i'));
  assert.match(data.draft, /\b(teh|becuase|recieve|definately)\b/i);
  assert.match(data.draft, /\b(people is|students is|they was|it are|it usually make)\b/i);
  assert.match(data.draft, /\b(did not understood|did not went|have went)\b/i);
  console.log(JSON.stringify({ words, count: data.draft.split(/\s+/).length, draft: data.draft, mainPoint: data.mainPoint }));
  previousDraft = data.draft;
}
const invalid = await fetch(`${base}/api/demo-draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'test', words: ['word', 'word'] }) });
assert.equal(invalid.status, 400);
console.log('Live demo generation passed: two distinct drafts, all target words, spelling examples, length, invalid input.');
