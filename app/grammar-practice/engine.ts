export type Feedback = { category: string; quote: string; correction?: string; why?: string; confidence?: string };
export type Question = { id: string; ruleId: string; prompt: string; referenceAnswer: string; acceptedAlternativeAnswers: string[]; target: { start: number; end: number; original: string; replacement: string } };
export type Match = { ruleId: string; source: "recheck" | "initial"; word?: string };
export type Selected = Question & { source: Match["source"] };
export const HISTORY_KEY = "thinkrevise-practice-history-v1";
const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").trim();
const words = (s: string) => s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?|[^\sA-Za-z]/g) || [];
function spanIndex(text: string, part: string) {
  if (!part) return -1;
  const escaped = norm(part).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![a-z])${escaped}(?![a-z])`).exec(norm(text));
  return match?.index ?? -1;
}

// LCS isolates actual proposed edits; unchanged words are never treated as errors.
export function edits(before: string, after: string): Array<[string, string]> {
  const a = words(before), b = words(after);
  if (a.length > 250 || b.length > 250) return [];
  const d = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) d[i][j] = a[i] === b[j] ? 1 + d[i + 1][j + 1] : Math.max(d[i + 1][j], d[i][j + 1]);
  let i = 0, j = 0, old: string[] = [], next: string[] = [];
  const result: Array<[string, string]> = [];
  const flush = () => {
    if (old.length || next.length) {
      // Preserve the left anchor for insertions (need → need to), so matching
      // cannot borrow an unrelated verb elsewhere in a long sentence.
      if (!old.length && i > 0) result.push([a[i - 1], [a[i - 1], ...next].join(" ")]);
      else result.push([old.join(" "), next.join(" ")]);
    }
    old = []; next = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { flush(); i++; j++; }
    else if (j < b.length && (i === a.length || d[i][j + 1] > d[i + 1][j])) next.push(b[j++]);
    else old.push(a[i++]);
  }
  flush(); return result;
}

function feedbackEdits(item: Feedback): Array<[string, string]> {
  const quoted = [...(item.why || "").matchAll(/[“"]([^”"\n]+)[”"]\s*→\s*[“"]([^”"\n]+)[”"]/g)].map(m => [m[1], m[2]] as [string, string]);
  if (quoted.length) return quoted.filter(([a]) => spanIndex(item.quote, a) >= 0);
  const text = item.correction || "";
  const pairs: Array<[string, string]> = [];
  for (const part of text.split(/[;；\n]/)) {
    const halves = part.split("→");
    if (halves.length !== 2) continue;
    const a = halves[0].trim().replace(/^[“"]|[”"]$/g, "");
    const b = halves[1].split(/[。\u4e00-\u9fff]/)[0].trim().replace(/^[“"]|[”"]$/g, "");
    if (a && b && spanIndex(item.quote, a) >= 0) pairs.push(...edits(a, b));
  }
  return pairs;
}

function classify(a: string, b: string, quote: string, bank: Question[]): string[] {
  a = norm(a); b = norm(b); const q = norm(quote);
  const pos = spanIndex(q,a); const prefix = pos >= 0 ? q.slice(0, pos) : "";
  // Context-specific rules take priority over generic edit-pair matches.
  if (a && /^(is|are)$/.test(a) && /^(is|are)$/.test(b) && a !== b) return [q.startsWith("there ") ? "agreement.existential-be" : "agreement.present-be"];
  if (a && /^(was|were)$/.test(a) && /^(was|were)$/.test(b) && a !== b) return [q.startsWith("there ") ? "agreement.existential-be" : "agreement.past-be"];
  if (/^(has|have)$/.test(a) && /^(has|have)$/.test(b) && a !== b) return ["agreement.have-agreement"];
  const aux = prefix.match(/\b(can|could|should|must|may|might|will|would|did|does)\s*$/)?.[1];
  if (aux && /^[a-z]+$/.test(a) && /^[a-z]+$/.test(b) && a !== b) return [`auxiliaries.${aux === "might" ? "may-might" : aux === "may" ? "may-might" : aux === "would" || aux === "will" ? "will-would" : aux}-base`];
  if (a === "a" && b === "an") return [/\ba\s+(hour|honest|honour|heir)/.test(q) ? "articles.silent-h" : "articles.an-vowel"];
  if (a === "an" && b === "a") return [/\ban\s+(uni|use|euro|one)/.test(q) ? "articles.consonant-sound-vowel-letter" : "articles.a-consonant"];
  if (a === "need" && b === "need to") return ["complements.need-to"];
  if (/^need\s+\w+$/.test(a) && b === a.replace("need ", "need to ")) return ["complements.need-to"];
  if ((a === "careful" && b === "carefully") || (a === "quick" && b === "quickly")) return ["word-forms.adverb-manner"];
  if (a === "themself" && b === "themselves") return ["pronouns.reflexive"];
  if (/^[a-z]+$/.test(a) && (b === a + "s" || b === a + "es" || (a.endsWith("y") && b === a.slice(0, -1) + "ies"))) {
    if (/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*$/.test(prefix)) return ["nouns.number-plural"];
    if (/\b(many|several|few|both|these|those)\s*$/.test(prefix)) return ["nouns.plural-quantifier"];
  }
  // Exact bank edit pairs provide a conservative vocabulary of supported repairs.
  const candidates = bank.filter(x => norm(x.target.original) === a && norm(x.target.replacement) === b);
  if (candidates.some(x => x.ruleId.startsWith("spelling."))) return [...new Set(candidates.filter(x => x.ruleId.startsWith("spelling.")).map(x => x.ruleId))];
  if (/^[a-z]+$/.test(a) && /^[a-z]+$/.test(b)) {
    const verbRules = candidates.filter(x => x.ruleId.startsWith("agreement."));
    if (verbRules.length) {
      if (/\beach\b|\bevery\b/.test(prefix)) return ["agreement.each-every"];
      if (/\bone of\b/.test(prefix)) return ["agreement.one-of"];
      if (verbRules.every(x => /singular-present|plural-present/.test(x.ruleId))) return [...new Set(verbRules.map(x => x.ruleId))];
    }
  }
  // Use a complete sentence match for context-dependent tense/passive/article rules.
  const exact = candidates.filter(x => norm(x.prompt) === q);
  if (exact.length) return [...new Set(exact.map(x => x.ruleId))];
  const safe = candidates.filter(x => /^(word-forms|pronouns|comparison-collocation)\./.test(x.ruleId));
  const unique = [...new Set(safe.map(x => x.ruleId))];
  return unique.length === 1 ? unique : [];
}

export function matchRules(initial: Feedback[], recheck: Feedback[], bank: Question[]): Match[] {
  const result: Match[] = [];
  for (const [items, source] of [[recheck, "recheck"], [initial, "initial"]] as const) {
    for (const item of items) {
      if (!/^(语言|Language)/i.test(item.category) || /学术|Academic|style|风格/i.test(item.category) || /^(低|low)$/i.test(item.confidence || "")) continue;
      const confirmed = feedbackEdits(item);
      // The bank's own sentences are also regression fixtures. Only accept an exact
      // source-and-reference pair, never a source sentence without a proposed repair.
      const exact = bank.find(q => norm(q.prompt) === norm(item.quote) && (item.correction || "").includes(q.referenceAnswer));
      const mapped = exact ? [[exact.target.original, exact.target.replacement, exact.ruleId]] : confirmed.flatMap(([a,b]) => classify(a,b,item.quote,bank).map(rule => [a,b,rule]));
      for (const [a, , ruleId] of mapped) {
        if (!bank.some(x => x.ruleId === ruleId)) continue;
        const word = ruleId.startsWith("spelling.") ? norm(a) : undefined;
        if (!result.some(x => x.ruleId === ruleId && x.word === word)) result.push({ ruleId, source, word });
      }
    }
  }
  return result;
}

export function selectQuestions(bank: Question[], matches: Match[], history: string[], rng = Math.random): Selected[] {
  const picked: Selected[] = [];
  const eligible = (m: Match) => bank.filter(q => q.ruleId === m.ruleId && (!m.word || norm(q.target.original) === m.word) && !picked.some(p => p.id === q.id));
  const choose = (m: Match) => {
    const candidates = eligible(m); if (!candidates.length) return;
    const unseen = candidates.filter(q => !history.includes(q.id));
    const pool = unseen.length ? unseen : candidates.filter(q => history.indexOf(q.id) === Math.min(...candidates.map(q => history.indexOf(q.id))));
    const q = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, rng()) * pool.length))];
    picked.push({ ...q, source: m.source });
  };
  for (const m of matches) { if (picked.length === 3) break; choose(m); }
  while (picked.length < 3) { const m = matches.find(m => eligible(m).length); if (!m) break; choose(m); }
  return picked;
}
export function readHistory(raw: string | null): string[] {
  try { const value: unknown = JSON.parse(raw || "[]"); return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === "string" && /^M\d{2}-Q\d{3}$/.test(x)))].slice(-480) : []; } catch { return []; }
}
export function addHistory(history: string[], ids: string[]) { return [...history.filter(x => !ids.includes(x)), ...ids].slice(-480); }

export function checkAttempt(q: Question, answer: string): "reference" | "needs-revision" | "review" {
  const clean = (s: string) => norm(s).replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
  const value = clean(answer);
  if ([q.referenceAnswer, ...q.acceptedAlternativeAnswers].some(s => clean(s) === value)) return "reference";
  if (value === clean(q.prompt)) return "needs-revision";
  // Only a narrow, independently reliable rule supports red after other edits:
  // an unchanged subject phrase followed by the original incorrect is/are/was/were.
  // Other rewrites are left for review, not graded by string inequality.
  if (["agreement.present-be", "agreement.past-be"].includes(q.ruleId)) {
    const prefix = clean(q.prompt.slice(0, q.target.start));
    const unchanged = `${prefix} ${clean(q.target.original)}`;
    if (prefix && (value === unchanged || value.startsWith(unchanged + " "))) return "needs-revision";
  }
  return "review";
}
