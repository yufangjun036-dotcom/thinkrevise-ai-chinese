export const demoCategories = ["中心论点", "论证与证据", "篇章衔接", "学术语域", "词汇表达", "语言准确性"] as const;

function exactWordPattern(word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, "i");
}

function normaliseIssueQuote(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

// Guarantee a familiar transposition error without misspelling a target word.
export function ensureDemoTypo(value: unknown, words: string[]) {
  const data = value as { draft?: unknown; issues?: unknown };
  if (!data || typeof data.draft !== "string" || !Array.isArray(data.issues)) return value;
  if (/\b(teh|becuase|recieve|definately)\b/i.test(data.draft)) return value;
  for (const [correct, wrong] of [["the", "teh"], ["because", "becuase"], ["receive", "recieve"], ["definitely", "definately"]]) {
    if (words.some((word) => word.toLowerCase() === correct)) continue;
    const match = new RegExp(`\\b${correct}\\b`, "i").exec(data.draft);
    if (!match) continue;
    const before = data.draft;
    data.draft = before.slice(0, match.index) + wrong + before.slice(match.index + match[0].length);
    data.issues = data.issues.map((issue) => {
      if (!issue || typeof issue.quote !== "string") return issue;
      const start = before.indexOf(issue.quote);
      if (start < 0 || match.index < start || match.index + match[0].length > start + issue.quote.length) return issue;
      const offset = match.index - start;
      return { ...issue, quote: issue.quote.slice(0, offset) + wrong + issue.quote.slice(offset + match[0].length) };
    });
    (data.issues as unknown[]).push({ category: "语言准确性", quote: wrong, correction: `${wrong} 应拼写为 ${correct}。` });
    break;
  }
  return data;
}

export function ensureDemoGrammar(value: unknown) {
  const data = value as { draft?: unknown; issues?: unknown };
  if (!data || typeof data.draft !== "string" || !Array.isArray(data.issues)) return value;
  const additions: string[] = [];
  if (!/\b(people is|students is|they was|it are|it usually make)\b/i.test(data.draft)) {
    const sentence = "People is often unsure about this.";
    additions.push(sentence);
    data.issues.push({ category: "语言准确性", quote: "People is", correction: "people 是复数，应使用 people are。" });
  }
  if (!/\b(did not understood|did not went|have went)\b/i.test(data.draft)) {
    additions.push("Last year, I did not understood why it mattered.");
    data.issues.push({ category: "语言准确性", quote: "did not understood", correction: "did 后使用动词原形，应写 did not understand。" });
  }
  if (additions.length) {
    // A short learner reflection belongs in the prose, never in a vocabulary appendix.
    const before = data.draft;
    const paragraphs = before.split(/\n\s*\n/);
    const position = paragraphs[0].length;
    const inserted = ` ${additions.join(" ")}`;
    paragraphs[0] += ` ${additions.join(" ")}`;
    data.draft = paragraphs.join("\n\n");
    data.issues = data.issues.map((issue) => {
      if (!issue || typeof issue.quote !== "string") return issue;
      const start = before.indexOf(issue.quote);
      if (start < 0 || position <= start || position >= start + issue.quote.length) return issue;
      const offset = position - start;
      return { ...issue, quote: issue.quote.slice(0, offset) + inserted + issue.quote.slice(offset) };
    });
  }
  return data;
}

// The generated issue list is private scaffolding for validating the practice
// draft. Do not reject an otherwise useful draft merely because the model
// omitted one metadata label; the learner-facing diagnosis is generated again
// from the final submitted text.
export function ensureDemoIssueCoverage(value: unknown) {
  const data = value as { draft?: unknown; issues?: unknown };
  if (!data || typeof data.draft !== "string" || !Array.isArray(data.issues)) return value;
  const draft = data.draft;
  const sentences = draft.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const fallbackQuote = sentences.find((sentence) => sentence.length >= 20) ?? draft.trim();
  if (!fallbackQuote) return value;
  const corrections: Record<(typeof demoCategories)[number], string> = {
    "中心论点": "检查中心论点是否具体、可论证，并避免绝对化表述。",
    "论证与证据": "补充理由、例子或限制条件，使结论得到充分支持。",
    "篇章衔接": "明确句子之间的逻辑关系，并使用恰当的衔接方式。",
    "学术语域": "替换口语化或含糊表达，使语气更正式、客观。",
    "词汇表达": "使用更准确、具体且避免重复的词汇。",
    "语言准确性": "检查拼写、主谓一致、时态和句子结构。",
  };
  for (const category of demoCategories) {
    const hasGroundedIssue = data.issues.some((issue) => issue && typeof issue === "object" && "category" in issue && issue.category === category && "quote" in issue && typeof issue.quote === "string" && draft.includes(issue.quote));
    if (!hasGroundedIssue) data.issues.push({ category, quote: fallbackQuote, correction: corrections[category] });
  }
  return data;
}

export function validateDemo(value: unknown, words: string[], previous = "") {
  const data = value as { draft?: unknown; mainPoint?: unknown; issues?: unknown };
  if (!data || typeof data.draft !== "string" || typeof data.mainPoint !== "string" || !Array.isArray(data.issues)) throw new Error("invalid shape");
  const draft = data.draft.trim();
  const count = draft.split(/\s+/).length;
  if (count < 80 || count > 150 || !data.mainPoint.trim()) throw new Error("invalid length");
  const missing = words.filter((word) => !exactWordPattern(word).test(draft));
  if (missing.length) throw new Error(`missing exact target words: ${missing.join(", ")}. Repair the rejected draft to include ALL of these naturally; preserve all other target words`);
  if (/key terms|target words|目标词/i.test(draft)) throw new Error("word list instead of prose");
  // A demo draft must read like a short article, not like a comma-separated
  // vocabulary exercise. The old fast path used the same "consider the role
  // of ..." frame for every word, so reject that shape before it can reach the
  // learner. We also reject target-word piles inside one sentence.
  const repeatedRoleFrame = draft.match(/\b(?:consider|explain|describe|discuss|show|present)\s+the\s+role\s+of\b/gi) ?? [];
  if (repeatedRoleFrame.length > 1) throw new Error("repetitive target-word template");
  const sentences = draft.split(/[.!?]+/).filter(Boolean);
  const targetCounts = sentences.map((sentence) => words.filter((word) => exactWordPattern(word).test(sentence)).length);
  const denseSentenceLimit = Math.max(4, Math.ceil(words.length * 0.65));
  if (Math.max(0, ...targetCounts) >= denseSentenceLimit && words.length >= 6) throw new Error("target words are concentrated in one sentence");
  const tokens = (text: string) => text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];
  const targetSet = new Set(words.map((word) => word.toLowerCase()));
  const targetFrames = new Map<string, string>();
  const draftTokens = tokens(draft);
  draftTokens.forEach((token, index) => {
    if (!targetSet.has(token)) return;
    const before = draftTokens.slice(Math.max(0, index - 3), index).join(" ");
    const after = draftTokens.slice(index + 1, index + 3).join(" ");
    const frame = `${before}|${after}`;
    if (!before || !after) return;
    if (targetFrames.has(frame)) throw new Error("target words reuse the same sentence frame");
    targetFrames.set(frame, token);
  });
  // Reject cosmetic reshuffles or a recycled opening paragraph.
  const grams = (text: string) => tokens(text).map((_, i, all) => all.slice(i, i + 5).join(" ")).filter((s) => s.split(" ").length === 5);
  const old = new Set(grams(previous));
  const current = grams(draft);
  if (old.size && current.filter((s) => old.has(s)).length / current.length > 0.45) throw new Error("draft too similar");
  const groundedIssues = data.issues.filter((issue: { category?: string; quote?: string; correction?: string }) => issue && typeof issue.category === "string" && typeof issue.quote === "string" && issue.quote.trim() && draft.includes(issue.quote) && typeof issue.correction === "string" && issue.correction.trim()) as Array<{ category: string; quote: string; correction: string }>;
  const uniqueIssueKeys = new Set<string>();
  for (const issue of groundedIssues) {
    const key = `${issue.category}|${normaliseIssueQuote(issue.quote)}`;
    if (uniqueIssueKeys.has(key)) throw new Error("duplicate demo issue");
    uniqueIssueKeys.add(key);
  }
  for (const category of demoCategories) {
    if (!groundedIssues.some((issue) => issue.category === category)) throw new Error(`missing grounded issue for ${category}: include this category with a verbatim continuous quote from draft and a correction`);
  }
  if (!/\b(teh|becuase|recieve|definately)\b/i.test(draft)) throw new Error("missing spelling example");
  return { draft, mainPoint: data.mainPoint.trim() };
}
