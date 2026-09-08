import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../app/coach-workspace.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const bannedInterfacePhrases = [
  "ORIGINAL IDEA",
  "AI-generated revision",
  "AI suggestions",
  "AI model revision",
  "Write one new sentence in English",
];

for (const phrase of bannedInterfacePhrases) {
  assert.ok(!workspace.includes(phrase), `Chinese UI still contains the interface phrase: ${phrase}`);
}
assert.ok(layout.includes('lang="zh-CN"'), "Chinese root metadata must keep zh-CN as its language");
assert.ok(workspace.includes("<strong>ThinkRevise AI</strong>"), "The visible Chinese-build brand name must remain ThinkRevise AI");
assert.ok(workspace.includes("Chinese · 学术英语教练"), "The visible brand must identify the Chinese build");
assert.ok(workspace.includes('path === "practice" ? limitWords(value, 300) : limitNonWhitespaceCharacters(value)'), "Each writing path must enforce its intended limit");
assert.ok(workspace.includes('${draftWordCount} / 300 词'), "Topic writing must display its 300-word counter");
assert.ok(workspace.includes('${draftWordCount} 词 · ${draftNonWhitespaceCount} / 6000 非空白字符'), "Academic revision must display words and the 6,000 non-whitespace-character allowance");
assert.ok(workspace.includes("InteractiveHighlightedDraft"), "Learner revision must connect feedback to highlighted source text");
assert.ok(workspace.includes("悬停查看提示；点击可固定"), "The highlighted-draft interaction must explain hover and pin behaviour");
assert.ok(styles.includes(".inline-issue-popover"), "Inline issue feedback must have visible popover styling");
assert.ok(styles.includes(".issue-navigator"), "Long drafts must include previous/next issue navigation");

console.log("Chinese-interface copy check passed.");
