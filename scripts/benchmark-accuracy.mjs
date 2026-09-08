import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const datasetPath = resolve(projectRoot, "benchmarks/accuracy/cases.json");
const reportDirectory = resolve(projectRoot, "reports/accuracy");
const allowedFamilies = new Set(["spelling", "agreement", "tense", "word_form", "noun_form", "register", "sentence_structure", "argument", "cohesion", "thesis", "other"]);

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const correctionGold = dataset.acceptedCorrectionsByKey ?? {};

function normalise(value) {
  return String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function categoryFamily(value) {
  if (/拼写|大小写/.test(value)) return "spelling";
  if (/主谓一致/.test(value)) return "agreement";
  if (/时态/.test(value)) return "tense";
  if (/词形|副词|动词形式/.test(value)) return "word_form";
  if (/冠词|单复数|不可数/.test(value)) return "noun_form";
  if (/句子完整|过长句|句法结构|残句|连写句|标点|句子连接|逗号拼接/.test(value)) return "sentence_structure";
  if (/中心观点|中心论点|主题句|论点聚焦/.test(value)) return "thesis";
  if (/衔接|连贯|段落结构|篇章/.test(value)) return "cohesion";
  if (/未经论证的强调|绝对|一概而论|过度确定/.test(value)) return "register";
  if (/论证|证据|理由|解释/.test(value)) return "argument";
  if (/学术|口语|非正式|个人化|绝对化|宽泛|强调|用词|语域|措辞/.test(value)) return "register";
  if (/语法|语言准确性/.test(value)) return "unclassified_grammar";
  return "other";
}
const isObjectiveFamily = family => ["spelling", "agreement", "tense", "word_form", "noun_form", "sentence_structure", "unclassified_grammar"].includes(family);
assert.ok(isObjectiveFamily(categoryFamily('语法')), 'A generic grammar label must not hide from objective error scoring');

function quotesOverlap(first, second) {
  const a = normalise(first);
  const b = normalise(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.includes(shorter) && shorter.length / longer.length >= 0.45;
}

function issueMatches(expected, actual) {
  const explicitAbsoluteClaim = expected.family === "register" && /\b(?:always|never|everyone|no one|nobody)\b/i.test(actual.quote ?? "");
  const expectedPhrase = ` ${normalise(expected.quote)} `;
  const source = String(actual.correction ?? "").includes("→") ? String(actual.correction).split("→")[0] : "";
  // A longer citation is acceptable when its inspectable edit explicitly targets
  // the gold span. Merely including a word in a whole paragraph is insufficient.
  const targetedContainedSpan = ` ${normalise(actual.quote)} `.includes(expectedPhrase)
    && ` ${normalise(source)} `.includes(expectedPhrase);
  return (expected.family === categoryFamily(actual.category) || explicitAbsoluteClaim) && (quotesOverlap(expected.quote, actual.quote) || targetedContainedSpan);
}

assert.ok(issueMatches({family:'register',quote:'always'}, {category:'过度绝对化',quote:'Automated feedback always improves',correction:'always improves → may improve'}));
assert.ok(!issueMatches({family:'register',quote:'always'}, {category:'学术语域',quote:'Automated feedback always improves',correction:'feedback → comments'}));

function correctionMatches(expected, actual) {
  const accepted = correctionGold[expected.key];
  if (!Array.isArray(accepted) || accepted.length === 0) return null;
  return accepted.some((candidate) => candidate === "→ I"
    ? String(actual.correction ?? "").includes(candidate)
    : normalise(actual.correction).includes(normalise(candidate)));
}

function validateIssues(issues, draft, caseId) {
  assert.ok(Array.isArray(issues), `${caseId}: issue list is missing`);
  const keys = new Set();
  for (const issue of issues) {
    assert.ok(issue.key && !keys.has(issue.key), `${caseId}: duplicate or empty issue key ${issue.key}`);
    keys.add(issue.key);
    assert.ok(["objective", "advisory"].includes(issue.tier), `${caseId}/${issue.key}: invalid tier`);
    assert.ok(allowedFamilies.has(issue.family), `${caseId}/${issue.key}: invalid family`);
    assert.ok(issue.quote && draft.toLocaleLowerCase().includes(issue.quote.toLocaleLowerCase()), `${caseId}/${issue.key}: quote is not verbatim in the draft`);
    if (issue.tier === "objective" && issue.family !== "sentence_structure") {
      assert.ok(Array.isArray(correctionGold[issue.key]) && correctionGold[issue.key].length > 0, `${caseId}/${issue.key}: objective issue needs an accepted correction`);
    }
  }
  return keys;
}

function validateDataset() {
  assert.match(dataset.version, /^\d+\.\d+\.\d+$/, "Benchmark version must use semantic versioning");
  assert.ok(Array.isArray(dataset.cases) && dataset.cases.length >= 30, "Benchmark needs at least 30 cases");
  const ids = new Set();
  let initialCount = 0;
  let revisionCount = 0;
  let objectiveCount = 0;
  let advisoryCount = 0;

  for (const testCase of dataset.cases) {
    assert.ok(testCase.id && !ids.has(testCase.id), `Duplicate or empty case id: ${testCase.id}`);
    ids.add(testCase.id);
    assert.ok(["initial", "revision"].includes(testCase.kind), `${testCase.id}: invalid kind`);
    if (testCase.kind === "initial") {
      initialCount += 1;
      assert.ok(testCase.draft?.trim().length >= 20, `${testCase.id}: draft is too short`);
      validateIssues(testCase.expectedIssues, testCase.draft, testCase.id);
      objectiveCount += testCase.expectedIssues.filter((issue) => issue.tier === "objective").length;
      advisoryCount += testCase.expectedIssues.filter((issue) => issue.tier === "advisory").length;
    } else {
      revisionCount += 1;
      assert.ok(testCase.originalDraft?.trim().length >= 20 && testCase.revisedDraft?.trim().length >= 20, `${testCase.id}: revision drafts are too short`);
      const originalKeys = validateIssues(testCase.originalIssues, testCase.originalDraft, testCase.id);
      const expectation = testCase.expectedRevision;
      assert.ok(expectation && Array.isArray(expectation.resolved) && Array.isArray(expectation.remaining) && Array.isArray(expectation.newIssues), `${testCase.id}: revision expectation is incomplete`);
      for (const key of [...expectation.resolved, ...expectation.remaining]) assert.ok(originalKeys.has(key), `${testCase.id}: unknown original issue key ${key}`);
      assert.equal(new Set([...expectation.resolved, ...expectation.remaining]).size, originalKeys.size, `${testCase.id}: every original issue must be resolved or remaining`);
      validateIssues(expectation.newIssues, testCase.revisedDraft, `${testCase.id}/new`);
    }
  }

  const representedFamilies = new Set(dataset.cases.flatMap((testCase) => testCase.kind === "initial"
    ? testCase.expectedIssues.map((issue) => issue.family)
    : [...testCase.originalIssues, ...testCase.expectedRevision.newIssues].map((issue) => issue.family)));
  for (const requiredFamily of ["spelling", "agreement", "tense", "word_form", "noun_form", "sentence_structure", "register", "thesis", "cohesion", "argument"]) {
    assert.ok(representedFamilies.has(requiredFamily), `Benchmark does not represent ${requiredFamily}`);
  }

  return { cases: dataset.cases.length, initialCount, revisionCount, objectiveCount, advisoryCount };
}

const validation = validateDataset();
const runLive = process.env.RUN_LIVE_BENCHMARK === "1";
const replayPath = process.env.BENCHMARK_REPLAY_REPORT;
const replayReport = replayPath ? JSON.parse(await readFile(resolve(replayPath), "utf8")) : null;

if (!runLive && !replayReport) {
  console.log(`Accuracy benchmark dataset passed: ${validation.cases} cases (${validation.initialCount} initial, ${validation.revisionCount} revision), ${validation.objectiveCount} objective and ${validation.advisoryCount} advisory gold issues.`);
  console.log("No API requests were made. Set RUN_LIVE_BENCHMARK=1 to execute a scored run.");
  process.exit(0);
}

const baseUrl = replayReport?.summary.baseUrl || process.env.PROTOTYPE_URL || "http://127.0.0.1:3002";
const endpoint = new URL("/api/coach", baseUrl);
const requestedIds = new Set((process.env.BENCHMARK_CASES || "").split(",").map((value) => value.trim()).filter(Boolean));
const requestedLimit = Number(process.env.BENCHMARK_LIMIT || 0);
let selectedCases = requestedIds.size ? dataset.cases.filter((testCase) => requestedIds.has(testCase.id)) : dataset.cases;
if (requestedIds.size) assert.equal(selectedCases.length, requestedIds.size, "One or more BENCHMARK_CASES ids do not exist");
if (Number.isFinite(requestedLimit) && requestedLimit > 0) selectedCases = selectedCases.slice(0, requestedLimit);
assert.ok(selectedCases.length > 0, "No benchmark cases selected");

const requestIntervalMs = Number(process.env.BENCHMARK_INTERVAL_MS || 15000);
assert.ok(Number.isFinite(requestIntervalMs) && requestIntervalMs >= 0 && requestIntervalMs <= 60000);
let lastRequestAt = 0;
async function requestCoach(body) {
  assert.ok(!replayReport, "Offline report replay must never make an API request");
  const waitMs = Math.max(0, lastRequestAt + requestIntervalMs - Date.now());
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
  const startedAt = performance.now();
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(70000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error || "unknown API error"}`);
  assert.equal(data.provider, "openai", "Demo/fallback output is not live accuracy evidence");
  return { data, durationMs: Math.round(performance.now() - startedAt) };
}

function scoreFeedback(expectedIssues, feedback, draft) {
  const usedActual = new Set();
  const matches = [];
  const misses = [];
  for (const expected of expectedIssues) {
    const actualIndex = feedback.findIndex((actual, index) => !usedActual.has(index) && issueMatches(expected, actual));
    if (actualIndex === -1) misses.push(expected);
    else {
      usedActual.add(actualIndex);
      matches.push({ expected, actual: feedback[actualIndex] });
    }
  }
  const objectiveActualIndexes = feedback.map((item, index) => ({ item, index })).filter(({ item }) => isObjectiveFamily(categoryFamily(item.category)));
  const objectiveExpected = expectedIssues.filter((issue) => issue.tier === "objective");
  const objectiveMatches = matches.filter(({ expected }) => expected.tier === "objective");
  const correctionChecks = objectiveMatches.map(({ expected, actual }) => correctionMatches(expected, actual)).filter((value) => value !== null);
  const unmatchedObjective = objectiveActualIndexes.filter(({ index }) => !usedActual.has(index));
  const locatable = feedback.filter((item) => item.quote && draft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())).length;
  const duplicates = feedback.filter((item, index) => feedback.slice(0, index).some((earlier) => categoryFamily(earlier.category) === categoryFamily(item.category) && quotesOverlap(earlier.quote, item.quote))).length;
  return {
    expected: expectedIssues.length,
    returned: feedback.length,
    matched: matches.length,
    objectiveExpected: objectiveExpected.length,
    objectiveMatched: objectiveMatches.length,
    objectiveReturned: objectiveActualIndexes.length,
    objectiveUnmatched: unmatchedObjective.map(({ item }) => item),
    objectiveCorrectionsChecked: correctionChecks.length,
    objectiveCorrectionsAccepted: correctionChecks.filter(Boolean).length,
    advisoryExpected: expectedIssues.filter((issue) => issue.tier === "advisory").length,
    advisoryMatched: matches.filter(({ expected }) => expected.tier === "advisory").length,
    unmatchedAdvisory: feedback.filter((item, index) => !usedActual.has(index) && !isObjectiveFamily(categoryFamily(item.category))),
    misses,
    locatable,
    duplicates,
  };
}

const results = [];
for (const [index, testCase] of selectedCases.entries()) {
  process.stdout.write(`[${index + 1}/${selectedCases.length}] ${testCase.id} ... `);
  try {
    const cached = replayReport?.results.find(result => result.id === testCase.id);
    if (replayReport && (!cached || cached.error)) throw new Error(cached?.error || "Not run in source report");
    if (cached) assert.equal(cached.provider, "openai");
    if (testCase.kind === "initial") {
      const { data, durationMs } = cached ? {data: cached.output, durationMs: cached.durationMs} : await requestCoach({
        draft: testCase.draft,
        mode: "coach",
        goal: "对初稿进行全面综合诊断",
        taskPrompt: `当前主题：${testCase.theme}`,
        selfCheck: { mainPoint: "测试用人工标注文本", weakness: "尚不确定，希望通过 AI 诊断进一步确认", help: "全面检查" },
      });
      results.push({ id: testCase.id, kind: testCase.kind, provider: data.provider, durationMs, output: data, score: scoreFeedback(testCase.expectedIssues, data.feedback, testCase.draft) });
      console.log(`${data.feedback.length} items, ${durationMs} ms`);
    } else {
      const initial = cached ? {data: cached.initialOutput, durationMs: cached.durationMs} : await requestCoach({
        draft: testCase.originalDraft,
        mode: "coach",
        goal: "对原稿进行全面综合诊断",
        taskPrompt: `当前主题：${testCase.theme}`,
        selfCheck: { mainPoint: "测试用人工标注文本", weakness: "多个方面均需要改进，希望进行综合诊断", help: "全面检查" },
      });
      const revision = cached ? {data: cached.output, durationMs: 0} : await requestCoach({
        phase: "revision",
        draft: testCase.revisedDraft,
        originalDraft: testCase.originalDraft,
        priorFeedback: initial.data.feedback,
        mode: "rewrite",
        goal: "独立复检并比较修改",
        taskPrompt: `当前主题：${testCase.theme}`,
        selfCheck: { mainPoint: "测试用人工标注文本", weakness: "多个方面均需要改进，希望进行综合诊断", help: "全面检查" },
      });
      const originalByKey = new Map(testCase.originalIssues.map((issue) => [issue.key, issue]));
      const resolvedQuotes = revision.data.revisionComparison?.resolved?.map((item) => item.quote) ?? [];
      const resolvedDetected = testCase.expectedRevision.resolved.filter((key) => resolvedQuotes.some((quote) => quotesOverlap(originalByKey.get(key).quote, quote)));
      const remainingDetected = testCase.expectedRevision.remaining.filter((key) => revision.data.feedback.some((item) => issueMatches(originalByKey.get(key), item)));
      const newDetected = testCase.expectedRevision.newIssues.filter((issue) => revision.data.feedback.some((item) => issueMatches(issue, item)));
      results.push({
        id: testCase.id,
        kind: testCase.kind,
        provider: revision.data.provider,
        durationMs: initial.durationMs + revision.durationMs,
        initialOutput: initial.data,
        output: revision.data,
        revision: {
          expectedResolved: testCase.expectedRevision.resolved.length,
          resolvedDetected: resolvedDetected.length,
          expectedRemaining: testCase.expectedRevision.remaining.length,
          remainingDetected: remainingDetected.length,
          expectedNew: testCase.expectedRevision.newIssues.length,
          newDetected: newDetected.length,
          locatable: revision.data.feedback.filter((item) => testCase.revisedDraft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())).length,
          returned: revision.data.feedback.length,
        },
      });
      console.log(`revision checked, ${initial.durationMs + revision.durationMs} ms`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ id: testCase.id, kind: testCase.kind, error: message });
    console.log(`ERROR: ${message}`);
    // Save partial evidence instead of repeating requests against an exhausted limit.
    if (/^429:|^503:|quota|budget/i.test(message)) break;
  }
}

const initialScores = results.filter((result) => result.score).map((result) => result.score);
const revisionScores = results.filter((result) => result.revision).map((result) => result.revision);
const totals = initialScores.reduce((sum, score) => ({
  objectiveExpected: sum.objectiveExpected + score.objectiveExpected,
  objectiveMatched: sum.objectiveMatched + score.objectiveMatched,
  objectiveReturned: sum.objectiveReturned + score.objectiveReturned,
  objectiveCorrectionsChecked: sum.objectiveCorrectionsChecked + score.objectiveCorrectionsChecked,
  objectiveCorrectionsAccepted: sum.objectiveCorrectionsAccepted + score.objectiveCorrectionsAccepted,
  advisoryExpected: sum.advisoryExpected + score.advisoryExpected,
  advisoryMatched: sum.advisoryMatched + score.advisoryMatched,
  returned: sum.returned + score.returned,
  locatable: sum.locatable + score.locatable,
  duplicates: sum.duplicates + score.duplicates,
}), { objectiveExpected: 0, objectiveMatched: 0, objectiveReturned: 0, objectiveCorrectionsChecked: 0, objectiveCorrectionsAccepted: 0, advisoryExpected: 0, advisoryMatched: 0, returned: 0, locatable: 0, duplicates: 0 });

const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(4)) : null;
const summary = {
  datasetVersion: dataset.version,
  generatedAt: new Date().toISOString(),
  evidenceMode: replayReport ? "offline-rescore" : "live",
  sourceReport: replayPath || null,
  sourceGeneratedAt: replayReport?.summary.generatedAt || null,
  baseUrl,
  selectedCases: selectedCases.length,
  completedCases: results.filter((result) => !result.error).length,
  failedCases: results.filter((result) => result.error).length,
  notRunCases: selectedCases.filter(testCase => !results.some(result => result.id === testCase.id)).map(testCase => testCase.id),
  objectiveRecall: ratio(totals.objectiveMatched, totals.objectiveExpected),
  objectivePrecisionAgainstGold: ratio(totals.objectiveMatched, totals.objectiveReturned),
  objectiveCorrectionAcceptance: ratio(totals.objectiveCorrectionsAccepted, totals.objectiveCorrectionsChecked),
  advisoryCoverage: ratio(totals.advisoryMatched, totals.advisoryExpected),
  quoteLocatability: ratio(totals.locatable, totals.returned),
  duplicateRate: ratio(totals.duplicates, totals.returned),
  objectiveFalsePositivesAgainstGold: totals.objectiveReturned - totals.objectiveMatched,
  strongTextObjectiveFalsePositives: results.filter((result) => result.id.startsWith("strong-") && result.score).reduce((sum, result) => sum + result.score.objectiveUnmatched.length, 0),
  revisionResolvedAccuracy: ratio(revisionScores.reduce((sum, item) => sum + item.resolvedDetected, 0), revisionScores.reduce((sum, item) => sum + item.expectedResolved, 0)),
  revisionRemainingRecall: ratio(revisionScores.reduce((sum, item) => sum + item.remainingDetected, 0), revisionScores.reduce((sum, item) => sum + item.expectedRemaining, 0)),
  revisionNewIssueRecall: ratio(revisionScores.reduce((sum, item) => sum + item.newDetected, 0), revisionScores.reduce((sum, item) => sum + item.expectedNew, 0)),
  averageDurationMs: Math.round(results.filter((result) => result.durationMs).reduce((sum, result) => sum + result.durationMs, 0) / Math.max(1, results.filter((result) => result.durationMs).length)),
};

const report = { summary, results };
await mkdir(reportDirectory, { recursive: true });
const stamp = summary.generatedAt.replace(/[:.]/g, "-");
const jsonPath = resolve(reportDirectory, `${stamp}.json`);
const markdownPath = resolve(reportDirectory, `${stamp}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(markdownPath, `# ThinkRevise AI accuracy benchmark\n\n- Dataset: ${summary.datasetVersion}\n- Generated: ${summary.generatedAt}\n- Cases: ${summary.completedCases}/${summary.selectedCases}\n- Objective recall: ${summary.objectiveRecall ?? "n/a"}\n- Objective precision against gold: ${summary.objectivePrecisionAgainstGold ?? "n/a"}\n- Objective correction acceptance: ${summary.objectiveCorrectionAcceptance ?? "n/a"}\n- Advisory coverage: ${summary.advisoryCoverage ?? "n/a"}\n- Quote locatability: ${summary.quoteLocatability ?? "n/a"}\n- Duplicate rate: ${summary.duplicateRate ?? "n/a"}\n- Objective false positives against gold: ${summary.objectiveFalsePositivesAgainstGold}\n- Strong-text objective false positives: ${summary.strongTextObjectiveFalsePositives}\n- Revision resolved accuracy: ${summary.revisionResolvedAccuracy ?? "n/a"}\n- Revision remaining recall: ${summary.revisionRemainingRecall ?? "n/a"}\n- Revision new-issue recall: ${summary.revisionNewIssueRecall ?? "n/a"}\n- Average duration: ${summary.averageDurationMs} ms\n\nThis is an automated comparison against the current gold set. Unmatched academic-writing suggestions require human adjudication before they are counted as false positives.\n`);

await appendFile(markdownPath, `\nEvidence mode: ${summary.evidenceMode}. Source report: ${summary.sourceReport ?? "this live run"}. Source generated at: ${summary.sourceGeneratedAt ?? summary.generatedAt}. Offline rescoring makes no new API requests.\n`);
console.log(JSON.stringify(summary, null, 2));
console.log(`Reports written to ${jsonPath} and ${markdownPath}`);
if (summary.failedCases > 0) process.exitCode = 1;
if (process.env.BENCHMARK_REQUIRE_ALL === "1") {
  const unmet = results.some(result => result.error || result.score?.misses?.length || result.score?.objectiveUnmatched?.length || result.score?.duplicates || (result.score && (result.score.locatable !== result.score.returned || result.score.objectiveCorrectionsAccepted !== result.score.objectiveCorrectionsChecked)) || (result.revision && (result.revision.expectedResolved !== result.revision.resolvedDetected || result.revision.expectedRemaining !== result.revision.remainingDetected || result.revision.expectedNew !== result.revision.newDetected || result.revision.locatable !== result.revision.returned)));
  if (unmet) { console.error("Selected-case accuracy gate failed; successful HTTP responses are not a passing score."); process.exitCode = 1; }
}
