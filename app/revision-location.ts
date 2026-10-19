// Local display alignment only. Never sent to the model or used as a verdict
// about whether a revision is correct.
export type RevisionLocation = { start: number; end: number } | null;
type Passage = { start: number; end: number; words: string[] };

const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const key = (tokens: string[]) => tokens.join(" ");

function passages(text: string): Passage[] {
  return Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)).flatMap(part => {
    const content = part.segment.trim();
    if (!content) return [];
    const start = part.index + part.segment.indexOf(content);
    return [{ start, end: start + content.length, words: words(content) }];
  });
}

function commonWords(a: string[], b: string[]) {
  if (a.length * b.length > 1_000_000) return key(a) === key(b) ? a.length : 0;
  let previous = new Uint16Array(b.length + 1);
  for (const word of a) {
    const current = new Uint16Array(b.length + 1);
    for (let j = 0; j < b.length; j++) current[j + 1] = word === b[j]
      ? previous[j] + 1 : Math.max(previous[j + 1], current[j]);
    previous = current;
  }
  return previous[b.length];
}

export function locateRevisedPassage(original: string, revised: string, quote: string, sourceStart?: number): RevisionLocation {
  const needle = quote.trim().replace(/^[“”"']+|[“”"']+$/g, "");
  if (!needle || !revised.trim()) return null;
  const lower = original.toLocaleLowerCase(), search = needle.toLocaleLowerCase();
  const start = sourceStart ?? lower.indexOf(search);
  if (start < 0 || lower.slice(start, start + search.length) !== search) return null;
  // Without a clicked occurrence, repeated quotations are ambiguous.
  if (sourceStart === undefined && lower.indexOf(search, start + 1) >= 0) return null;
  const left = passages(original), right = passages(revised);
  const first = left.findIndex(part => part.start <= start && part.end > start);
  const last = left.findIndex(part => part.end >= start + needle.length);
  if (first < 0 || last < first) return null;
  const source = { start: left[first].start, end: left[last].end };
  if (original === revised) return source;
  const sourceWords = words(original.slice(source.start, source.end));
  if (!sourceWords.length) return null;
  const spanCount = last - first + 1;
  if (spanCount > 6) return null; // No guessed broad alignment across a rewrite.
  const originalOccurrences = left.filter((_, index) => key(left.slice(index, index + spanCount).flatMap(part => part.words)) === key(sourceWords)).length;
  const neighbourMatches = (before: Passage | undefined, after: Passage | undefined) => {
    if (!before || !after || before.words.length < 3) return 0;
    const common = commonWords(before.words, after.words);
    return common / Math.max(before.words.length, after.words.length) >= 0.85 ? 1 : 0;
  };
  const candidates: Array<Passage & { score: number }> = [];
  for (let index = 0; index < right.length; index++) {
    for (let count = Math.max(1, spanCount - 1); count <= spanCount + 1 && index + count <= right.length; count++) {
      const group = right.slice(index, index + count);
      const targetWords = group.flatMap(part => part.words);
      if (!targetWords.length) continue;
      const common = commonWords(sourceWords, targetWords);
      const retention = common / sourceWords.length, precision = common / targetWords.length;
      if (retention < 0.65 || precision < 0.65 || common < Math.min(4, Math.ceil(sourceWords.length * 0.65))) continue;
      const neighbours = neighbourMatches(left[first - 1], right[index - 1]) + neighbourMatches(left[last + 1], right[index + count]);
      const exact = key(sourceWords) === key(targetWords);
      if ((originalOccurrences > 1 || (!exact && common < 4)) && !neighbours) continue;
      candidates.push({ start: group[0].start, end: group.at(-1)!.end, words: targetWords,
        score: 2 * common / (sourceWords.length + targetWords.length) + neighbours * 0.15 });
    }
  }
  candidates.sort((a, b) => b.score - a.score || (a.end - a.start) - (b.end - b.start));
  const best = candidates[0];
  if (!best) return null;
  // Competing windows around the same sentence are one location; a second
  // non-overlapping near-match is not enough evidence for a confident jump.
  const rival = candidates.find(candidate => candidate.end <= best.start || candidate.start >= best.end);
  if (rival && best.score - rival.score < 0.12) return null;
  return { start: best.start, end: best.end };
}
