export const MAX_DRAFT_NON_WHITESPACE_CHARACTERS = 6000;

// This secondary ceiling is only a transport-safety guard. Normal spaces and
// line breaks do not consume the learner-facing 6,000-character allowance.
export const MAX_RAW_DRAFT_CHARACTERS = 12000;

export function countNonWhitespaceCharacters(text: string) {
  return Array.from(text).reduce((total, character) => total + (/\s/u.test(character) ? 0 : 1), 0);
}

export function limitNonWhitespaceCharacters(
  text: string,
  maximum = MAX_DRAFT_NON_WHITESPACE_CHARACTERS,
) {
  let nonWhitespaceCount = 0;
  let rawCount = 0;
  let result = "";

  for (const character of text) {
    if (rawCount >= MAX_RAW_DRAFT_CHARACTERS) break;
    rawCount += 1;

    if (!/\s/u.test(character)) {
      if (nonWhitespaceCount >= maximum) continue;
      nonWhitespaceCount += 1;
    }

    result += character;
  }

  return result;
}
