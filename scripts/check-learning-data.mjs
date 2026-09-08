import assert from "node:assert/strict";
import { buildFastDemoDraft, curatedKeywordBank, demoDrafts, helpModes, levels, pickVocabulary, topics, vocabulary } from "../app/data.ts";

assert.equal(topics.length, 5, "Expected four curated topics and one custom topic");
assert.equal(new Set(topics.map((item) => item.id)).size, topics.length, "Topic IDs must be unique");
assert.deepEqual(
  helpModes.map((item) => item.id),
  ["coach", "model", "rewrite"],
  "The three support levels must remain complete and ordered",
);
assert.deepEqual(Object.keys(demoDrafts).sort(), topics.map((item) => item.id).sort(), "Every topic needs a matching demo draft");
for (const topic of ["education-ai", "university", "technology", "environment"]) {
  assert.ok(new Set(curatedKeywordBank[topic]).size >= 200, `${topic} keyword bank needs at least 200 unique words`);
  assert.ok(curatedKeywordBank[topic].every((word) => !["the", "a", "an", "happy"].includes(word)), `${topic} keyword bank contains a generic prompt word`);
  const topicWords = vocabulary.filter((item) => item.topics.includes(topic));
  assert.ok(new Set(topicWords.map((item) => item.word)).size >= 200, `${topic} needs at least 200 unique curated words`);
  assert.ok(topicWords.every((item) => !["the", "a", "an", "happy"].includes(item.word)), `${topic} contains a generic prompt word`);
  assert.ok(topicWords.every((item) => item.definition && !item.definition.includes("相关学术概念") && item.definition !== "中文释义暂缺"), `${topic} contains a missing or placeholder Chinese translation`);
}
for (const [topic, draft] of Object.entries(demoDrafts)) {
  const wordCount = draft.trim().split(/\s+/).length;
  assert.ok(wordCount >= 80 && wordCount <= 150, `${topic} demo draft must stay within the displayed 80-150 word guidance`);
}

for (const topic of topics) {
  for (const level of levels) {
    for (let run = 0; run < 20; run += 1) {
      const words = pickVocabulary(topic.id, level.id);
      assert.equal(words.length, level.count, `${topic.id}/${level.id} returned the wrong word count`);
      assert.equal(new Set(words.map((item) => item.word)).size, words.length, "A draw must not repeat words");
      if (topic.id !== "custom") {
        assert.ok(words.every((item) => item.topics.includes(topic.id)), `${topic.id} returned an unrelated word`);
      }
      const maximumLevel = levels.findIndex((item) => item.id === level.id);
      assert.ok(
        words.every((item) => levels.findIndex((candidate) => candidate.id === item.level) <= maximumLevel),
        `${topic.id}/${level.id} returned a word above the selected level`,
      );
      const fastDraft = buildFastDemoDraft(topic.id, words);
      const fastCount = fastDraft.trim().split(/\s+/).length;
      assert.ok(fastCount >= 80 && fastCount <= 150, `${topic.id}/${level.id} fast demo must stay within the displayed 80-150 word guidance`);
      for (const item of words) assert.match(fastDraft, new RegExp(`(^|[^A-Za-z])${item.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`, "i"), `${topic.id}/${level.id} fast demo must include ${item.word}`);
    }
  }
}

console.log(`Learning-data checks passed for ${topics.length * levels.length} topic/level combinations.`);
