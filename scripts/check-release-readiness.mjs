import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [
  packageJson,
  gitignore,
  layout,
  workspace,
  styles,
  nextConfig,
  privacy,
  roadmap,
  releaseChecklist,
  languageChecklist,
] = await Promise.all([
  source("../package.json"),
  source("../.gitignore"),
  source("../app/layout.tsx"),
  source("../app/coach-workspace.tsx"),
  source("../app/globals.css"),
  source("../next.config.ts"),
  source("../app/privacy/page.tsx"),
  source("../docs/ROADMAP_ZH.md"),
  source("../docs/RELEASE_CHECKLIST_ZH.md"),
  source("../docs/LANGUAGE_PARITY_CHECKLIST.md"),
]);

const scripts = JSON.parse(packageJson).scripts;
assert.equal(JSON.parse(packageJson).name, "thinkrevise-ai-chinese", "The Chinese package name has drifted");
for (const required of ["lint", "check:data", "check:limits", "check:copy", "check:safeguards", "check:security", "benchmark:validate", "build"]) {
  assert.match(scripts.verify, new RegExp(`npm run ${required.replace(":", "\\:")}`), `verify is missing ${required}`);
}
assert.match(scripts["verify:release"], /npm run verify/);
assert.match(scripts["verify:release"], /npm run check:release/);

assert.match(gitignore, /^\.env\*/m, "Environment files must remain excluded from Git");
assert.match(layout, /lang="zh-CN"/, "The validated build must remain the Chinese version");
assert.match(layout, /ThinkRevise AI \(Chinese\)/, "The Chinese candidate metadata name is missing");
assert.match(workspace, /中文版候选版/, "The candidate-build label is missing");
assert.doesNotMatch(workspace, /> 中文原型</, "The old prototype label must not return");
assert.match(workspace, /apiRequestHeaders\(\)/, "AI requests must use an anonymous same-tab session identifier");
assert.match(workspace, /InteractiveHighlightedDraft/, "Issue locations must remain connected to inline guidance");
assert.match(workspace, /role="alert"/, "Learner-facing errors must be announced");
assert.match(workspace, /role="dialog"/, "Inline issue guidance must expose dialog semantics");
assert.match(workspace, /aria-label="关闭修改提示"/, "Inline issue guidance must have an accessible close action");
assert.match(styles, /@media\s*\(max-width:\s*900px\)/, "The tablet/mobile stacking breakpoint is missing");
assert.match(styles, /@media\s*\(max-width:\s*640px\)/, "The narrow-phone breakpoint is missing");
assert.match(styles, /\.setup-columns,\s*\.feedback-grid,\s*\.comparison-grid\s*\{\s*grid-template-columns:\s*1fr/, "Comparisons must stack on narrow screens");
assert.match(styles, /:focus-visible/, "Keyboard focus styling is missing");
assert.match(styles, /prefers-reduced-motion/, "Reduced-motion support is missing");
assert.match(nextConfig, /poweredByHeader:\s*false/);
assert.match(nextConfig, /X-Frame-Options/);
assert.match(privacy, /API 数据默认不会用于训练模型/);
assert.match(roadmap, /阶段 4E/);
assert.match(languageChecklist, /Chinese version is the source of truth/i);

for (const section of ["自动发布门", "桌面人工验收", "手机人工验收", "真实 AI 验收", "隐私与费用", "GitHub 前检查", "阻断发布的情况"]) {
  assert.ok(releaseChecklist.includes(section), `Release checklist is missing: ${section}`);
}

console.log("Release-readiness source and checklist checks passed. No paid API request was made.");
