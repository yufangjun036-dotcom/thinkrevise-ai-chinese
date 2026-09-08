import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const benchmarkDir = resolve(root, "benchmarks/accuracy");
const packetPath = resolve(benchmarkDir, "INDEPENDENT_REVIEW_PACKET_ZH.md");
const templatePath = resolve(benchmarkDir, "independent-review-response.template.json");
const readJson = async (name) => JSON.parse(await readFile(resolve(benchmarkDir, name), "utf8"));

const [base, stability, longform] = await Promise.all([
  readJson("cases.json"),
  readJson("academic-stability-cases.json"),
  readJson("academic-longform-cases.json"),
]);

const cases = [];
for (const item of base.cases) {
  const labels = [];
  if (item.kind === "initial") {
    item.expectedIssues.forEach((issue, index) => labels.push({
      id: `${item.id}:issue:${index + 1}`,
      tier: issue.tier,
      family: issue.family,
      quote: issue.quote,
      proposal: "该片段存在预设类别所描述的问题",
    }));
    cases.push({ id: item.id, source: "基础集", draft: item.draft, labels });
  } else {
    item.originalIssues.forEach((issue, index) => labels.push({
      id: `${item.id}:original:${index + 1}`,
      tier: issue.tier,
      family: issue.family,
      quote: issue.quote,
      proposal: item.expectedRevision.resolved.includes(issue.key) ? "第二稿中已解决" : "第二稿中仍存在",
    }));
    item.expectedRevision.newIssues.forEach((issue, index) => labels.push({
      id: `${item.id}:new:${index + 1}`,
      tier: issue.tier,
      family: issue.family,
      quote: issue.quote,
      proposal: "第二稿中新出现的问题",
    }));
    cases.push({ id: item.id, source: "基础集·第二稿", draft: item.originalDraft, revisedDraft: item.revisedDraft, labels });
  }
}

for (const [source, dataset] of [["学术稳定性集", stability], ["学术长文集", longform]]) {
  dataset.cases.forEach((item) => cases.push({
    id: item.id,
    source,
    draft: item.draft,
    labels: [{
      id: `${item.id}:judgement:1`,
      tier: "advisory",
      family: item.dimension,
      quote: item.draft,
      proposal: item.polarity === "issue" ? "该维度存在实质问题" : "该维度不应报告问题",
      rationale: item.rationale,
    }],
  }));
}

const judgments = cases.flatMap((item) => item.labels.map((label) => ({
  caseId: item.id,
  labelId: label.id,
  verdict: "pending",
  correctedFamily: "",
  correctedQuote: "",
  notes: "",
})));
const template = {
  version: "0.1.0",
  reviewer: { anonymousId: "", background: "", reviewedAt: "" },
  allowedVerdicts: ["agree", "modify", "delete", "uncertain"],
  judgments,
  additionalFindings: [],
};

const escapeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", "<br>");
const sections = cases.map((item, caseIndex) => {
  const rows = item.labels.map((label) => `| ${escapeCell(label.id)} | ${escapeCell(label.tier)} / ${escapeCell(label.family)} | ${escapeCell(label.quote)} | ${escapeCell(label.proposal)}${label.rationale ? `<br>${escapeCell(label.rationale)}` : ""} |  |  |`).join("\n");
  return `## ${caseIndex + 1}. ${item.id}\n\n- 来源：${item.source}\n\n**原稿**\n\n> ${item.draft.replaceAll("\n", "\n> ")}\n${item.revisedDraft ? `\n**第二稿**\n\n> ${item.revisedDraft.replaceAll("\n", "\n> ")}\n` : ""}\n| 标签编号 | 层级／类别 | 预设引文 | 预设判断 | 判定 | 修改或删除理由 |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n\n额外发现：\n`;
}).join("\n---\n\n");

const packet = `# ThinkRevise AI 独立学术英语盲审表\n\n生成自当前内部测试集。评审者不得查看产品输出、提示词、历史报告或修复记录。\n\n## 填写方法\n\n- 判定只填写：同意、修改、删除、不确定。\n- “修改”必须写明正确类别、引文范围或理由。\n- “删除”表示问题不成立，或只是一种没有课程／学科依据的文体偏好。\n- 每篇都检查是否存在预设标签之外的明确问题；有则写在“额外发现”。\n- 不因系统可能如何输出而改变判断。\n\n## 评审者信息\n\n- 匿名编号：\n- 学术英语相关背景：\n- 评审日期：\n\n${sections}`;

if (process.argv.includes("--check")) {
  assert.equal(await readFile(packetPath, "utf8"), packet, "Independent review packet is out of date");
  assert.deepEqual(JSON.parse(await readFile(templatePath, "utf8")), template, "Independent review response template is out of date");
  console.log(`Independent review assets are current: ${cases.length} cases and ${judgments.length} labels.`);
} else {
  await writeFile(packetPath, packet);
  await writeFile(templatePath, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`Independent review assets generated: ${cases.length} cases and ${judgments.length} labels.`);
}
