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
assert.ok(workspace.includes("复制教师任务链接"), "教师必须可以分享不含学生初稿的作业设置");
assert.ok(workspace.includes("这些内容不会发送给 AI"), "作业背景必须保留在 AI 请求边界之外");
assert.ok(workspace.includes("决定如何使用一条 AI 建议"), "学习流程必须记录学生对反馈的判断");
assert.ok(workspace.includes("下载学习报告"), "完成后的学习记录必须可以下载");
assert.ok(workspace.includes("const [assignmentBrief") && !workspace.includes("taskPrompt: assignmentBrief"), "作业设置不得改变既有 AI 提示词");
assert.ok(styles.includes(".assignment-brief") && styles.includes(".feedback-decision"), "新增学习流程控件必须具备响应式样式");

console.log("Chinese-interface copy check passed.");
