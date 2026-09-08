import assert from "node:assert/strict";
import {
  countNonWhitespaceCharacters,
  limitNonWhitespaceCharacters,
  MAX_DRAFT_NON_WHITESPACE_CHARACTERS,
  MAX_RAW_DRAFT_CHARACTERS,
} from "../app/text-limits.ts";

const demoDraft = "Nowadays, AI is really good for university students. It gives a lot of feedback and students can finish work fast. For example, a student can ask a chatbot to improve an essay in a few seconds. But sometimes students just use the answer and do not think about whether it is correct. They may also accept invented information. Many students is using AI without checking the answer careful, and teh feedback can be confusing. I think universities should teach students how to evaluate AI feedback because it is important. This teaching can help students use technology in a responsible way and still develop their own judgement.";

assert.equal(countNonWhitespaceCharacters(demoDraft), 521, "Demo count must exclude its 105 spaces");
assert.equal(countNonWhitespaceCharacters("a b\nc\td!"), 5, "Spaces, line breaks and tabs must not count");

const spacedBoundary = `${"a".repeat(MAX_DRAFT_NON_WHITESPACE_CHARACTERS)}     `;
assert.equal(countNonWhitespaceCharacters(limitNonWhitespaceCharacters(spacedBoundary)), MAX_DRAFT_NON_WHITESPACE_CHARACTERS);

const overLimit = `${"a".repeat(MAX_DRAFT_NON_WHITESPACE_CHARACTERS)} EXTRA`;
const limited = limitNonWhitespaceCharacters(overLimit);
assert.equal(countNonWhitespaceCharacters(limited), MAX_DRAFT_NON_WHITESPACE_CHARACTERS);
assert.ok(!limited.includes("EXTRA"), "Non-whitespace content past the limit must be removed");

const rawOverflow = `a${" ".repeat(MAX_RAW_DRAFT_CHARACTERS)}b`;
assert.ok(Array.from(limitNonWhitespaceCharacters(rawOverflow)).length <= MAX_RAW_DRAFT_CHARACTERS, "Raw transport guard must cap whitespace-heavy input");

console.log("Draft non-whitespace limit checks passed.");
