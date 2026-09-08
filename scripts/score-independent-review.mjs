import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const templatePath = resolve(root, "benchmarks/accuracy/independent-review-response.template.json");
const template = JSON.parse(await readFile(templatePath, "utf8"));
const expectedIds = new Set(template.judgments.map((item) => item.labelId));
const sourcePath = process.env.INDEPENDENT_REVIEW_FILE;
const review = sourcePath ? JSON.parse(await readFile(resolve(sourcePath), "utf8")) : template;
const checkTemplate = process.argv.includes("--check-template");

assert.ok(Array.isArray(review.judgments), "Review judgments are missing");
assert.equal(review.judgments.length, expectedIds.size, "Review must contain every prepared label exactly once");
assert.equal(new Set(review.judgments.map((item) => item.labelId)).size, expectedIds.size, "Review contains duplicate label ids");
for (const item of review.judgments) assert.ok(expectedIds.has(item.labelId), `Unknown label id: ${item.labelId}`);

if (checkTemplate) {
  assert.ok(review.judgments.every((item) => item.verdict === "pending"), "The committed template must remain blank");
  console.log(`Independent review template passed: ${review.judgments.length} labels are ready for blind review.`);
  process.exit(0);
}

const allowed = new Set(template.allowedVerdicts);
assert.ok(review.reviewer?.anonymousId?.trim(), "Reviewer anonymousId is required");
assert.ok(review.reviewer?.background?.trim(), "Reviewer background is required");
assert.match(review.reviewer?.reviewedAt ?? "", /^\d{4}-\d{2}-\d{2}/, "reviewedAt must begin with YYYY-MM-DD");
for (const item of review.judgments) {
  assert.ok(allowed.has(item.verdict), `${item.labelId}: verdict must be agree, modify, delete, or uncertain`);
  if (item.verdict === "modify" || item.verdict === "delete") assert.ok(item.notes?.trim(), `${item.labelId}: modified or deleted labels need notes`);
}
assert.ok(Array.isArray(review.additionalFindings), "additionalFindings must be an array");

const counts = Object.fromEntries([...allowed].map((verdict) => [verdict, review.judgments.filter((item) => item.verdict === verdict).length]));
const decisive = counts.agree + counts.modify + counts.delete;
console.log(JSON.stringify({
  reviewer: review.reviewer.anonymousId,
  reviewedAt: review.reviewer.reviewedAt,
  totalLabels: review.judgments.length,
  ...counts,
  decisiveAgreement: decisive ? Number((counts.agree / decisive).toFixed(4)) : null,
  additionalFindings: review.additionalFindings.length,
  releaseGate: counts.delete === 0 && counts.uncertain === 0 ? "eligible_for_adjudication" : "requires_adjudication",
}, null, 2));
