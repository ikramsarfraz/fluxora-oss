import type { PdfRow } from "../services/extract-pdf-text";

/**
 * Map a parsed line's vendor-product description back to the on-page row that
 * produced it. The parser doesn't preserve text-row → line-item provenance
 * after the AI merge, so this is a post-process: we tokenise the description
 * and pick the row with the highest Jaccard overlap. Below MIN_SCORE we
 * decline rather than guess.
 *
 * Used only to attach `bbox` to `UnresolvedLine`s for the Review screen's
 * highlight overlay; nothing downstream of the parse depends on correctness
 * here. If we ever swap the parser for a vision-OCR provider we can drop this
 * heuristic and use the provider's per-line boxes directly.
 */
const MIN_TOKEN_LENGTH = 2;
const MIN_SCORE = 0.25;
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "than",
  "your",
  "our",
  "are",
  "was",
  "you",
  "but",
  "not",
]);

function tokenize(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function findRowForLine(
  description: string,
  rows: PdfRow[],
): PdfRow | null {
  const lineTokens = tokenize(description);
  if (lineTokens.size === 0) return null;

  let best: PdfRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = jaccard(lineTokens, tokenize(row.text));
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= MIN_SCORE ? best : null;
}
