import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.THINKREVISE_BASE_URL || process.env.REVISIONCOACH_BASE_URL || "http://127.0.0.1:3003";

async function postRaw(body) {
  const response = await fetch(`${baseUrl}/api/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store", "Every response must disable caching");
  return { response, data };
}

async function post(body) {
  return postRaw(JSON.stringify(body));
}

async function expectRejected(body, expectedText) {
  const { response, data } = await post(body);
  assert.equal(response.status, 400);
  assert.match(data.error, expectedText);
}

try {
  {
    const { response, data } = await postRaw("{broken-json");
    assert.equal(response.status, 400);
    assert.match(data.error, /请求格式无效/);
  }

  const exactlySixThousand = "a".repeat(6000);
  {
    const { response, data } = await post({ draft: exactlySixThousand, mode: "coach" });
    assert.equal(response.status, 200);
    assert.equal(data.provider, "demo", "Recovery test server must run without a real API key");
    assert.ok(Array.isArray(data.feedback));
  }

  await expectRejected({ draft: "a".repeat(6001), mode: "coach" }, /6000 个非空白字符/);
  await expectRejected({ draft: `This is a valid draft.${" ".repeat(12000)}`, mode: "coach" }, /过多空格或换行/);
  await expectRejected({ draft: "This is a valid second draft for review.", phase: "revision", originalDraft: "a".repeat(6001) }, /用于比较的原稿不能超过 6000/);
  await expectRejected({ draft: "This is a valid second draft for review.", phase: "revision", priorFeedback: Array.from({ length: 37 }, () => ({})) }, /反馈数量超出/);
  await expectRejected({ draft: "This is a valid second draft for review.", phase: "revision", priorFeedback: [{ why: "a".repeat(501) }] }, /单项反馈内容不能超过 500/);

  const wordPastedDraft = [
    "In recent years, students have used AI-supported tools—especially writing assistants—to revise coursework.",
    "However, ‘fast’ feedback is not always reliable; learners must compare claims, evidence, and context.",
    "British spelling such as behaviour and organisation may coexist with American spelling when a course permits it.",
    "中文说明不应让页面崩溃，but the academic English diagnosis should remain usable.",
  ].join("\n\n").replace("learners", "learners\u00a0");
  {
    const { response, data } = await post({ draft: wordPastedDraft, mode: "coach", taskPrompt: "大学学习与人工智能" });
    assert.equal(response.status, 200);
    assert.equal(data.provider, "demo");
    assert.ok(typeof data.summary === "string" && data.summary.length > 0);
  }

  const workspace = await readFile(new URL("../app/coach-workspace.tsx", import.meta.url), "utf8");
  const coachRoute = await readFile(new URL("../app/api/coach/route.ts", import.meta.url), "utf8");
  const topicRoute = await readFile(new URL("../app/api/custom-topic/route.ts", import.meta.url), "utf8");
  const demoRoute = await readFile(new URL("../app/api/demo-draft/route.ts", import.meta.url), "utf8");

  for (const controller of ["topicController", "demoDraftController", "feedbackController", "revisionController"]) {
    assert.match(workspace, new RegExp(`if \\(${controller}\\.current\\) return`), `${controller} must block duplicate submissions`);
    assert.match(workspace, new RegExp(`${controller}\\.current\\?\\.abort\\(\\)`), `${controller} must be cancelled on navigation/reset`);
  }
  assert.match(workspace, /服务返回的内容格式异常，请重试；你的文章仍保留在当前页面。/);
  assert.match(workspace, /thinkrevise-session-v1/);
  assert.match(workspace, /LEGACY_SESSION_RECOVERY_KEY/, "Existing RevisionCoach writing sessions must migrate safely");
  assert.match(workspace, /window\.sessionStorage\.setItem/);
  assert.match(workspace, /window\.crypto\?\.getRandomValues/);
  assert.doesNotMatch(workspace, /session\s*=\s*crypto\.randomUUID\(\)/);
  assert.match(workspace, /已恢复本标签页刷新前的写作进度/);
  assert.match(workspace, /requestedStage === "reflect" && !savedRevisionResponse/);
  assert.match(coachRoute, /AbortSignal\.any\(\[request\.signal, timeoutSignal\]\)/);
  assert.match(topicRoute, /AbortSignal\.any\(\[request\.signal, AbortSignal\.timeout/);
  assert.match(demoRoute, /request\.signal\.aborted/);

  console.log("Boundary and recovery checks passed.");
} catch (error) {
  console.error(`Boundary and recovery checks failed against ${baseUrl}.`);
  throw error;
}
