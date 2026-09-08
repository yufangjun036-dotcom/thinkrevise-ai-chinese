import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const examplePath = resolve(root, "benchmarks/accuracy/external-samples.example.json");
const sourcePath = process.env.EXTERNAL_SAMPLE_FILE;
const dataset = JSON.parse(await readFile(sourcePath ? resolve(sourcePath) : examplePath, "utf8"));
const templateOnly = !sourcePath;

assert.match(dataset.version ?? "", /^\d+\.\d+\.\d+$/, "External sample version must use semantic versioning");
assert.ok(Array.isArray(dataset.samples) && dataset.samples.length > 0, "External samples are missing");
assert.equal(new Set(dataset.samples.map((item) => item.id)).size, dataset.samples.length, "External sample ids must be unique");

if (templateOnly) {
  assert.equal(dataset.status, "template_only");
  assert.equal(dataset.samples.length, 1);
  assert.equal(dataset.samples[0].consentConfirmed, false);
  assert.equal(dataset.samples[0].anonymised, false);
  assert.equal(dataset.samples[0].draft, "");
  console.log("External sample template passed. No private essay was read or uploaded.");
  process.exit(0);
}

assert.ok(dataset.samples.length >= 10, "Formal external evaluation needs at least 10 anonymous samples");
for (const item of dataset.samples) {
  assert.match(item.id ?? "", /^real-[a-z0-9-]+$/i, "External sample id must be anonymous and begin with real-");
  assert.equal(item.consentConfirmed, true, `${item.id}: author consent is not confirmed`);
  assert.equal(item.anonymised, true, `${item.id}: anonymisation is not confirmed`);
  assert.ok(item.proficiencyBand?.trim(), `${item.id}: proficiencyBand is required`);
  assert.ok(item.discipline?.trim(), `${item.id}: discipline is required`);
  const words = String(item.draft ?? "").trim().match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) ?? [];
  assert.ok(words.length >= 100 && words.length <= 600, `${item.id}: draft must contain 100–600 English words`);
}
console.log(`External sample intake passed: ${dataset.samples.length} consented, anonymised drafts. No API request was made.`);
