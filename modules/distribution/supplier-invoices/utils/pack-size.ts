/**
 * Deterministic pack-size extraction from invoice description text.
 *
 * We previously asked the AI to emit `unitsPerPackage` as a top-level
 * strict-schema field. That broke OpenAI's structured-output
 * reliability on real bills (the model intermittently returned an
 * empty parsed response). The fix: keep the AI contract minimal and
 * recover pack size deterministically from the description string,
 * which the prompt already encourages the model to copy verbatim
 * ("24 (11 oz) cans per case", "12 PK", "case of 12", etc.).
 *
 * Returns the inferred pack size for the line, or null when the
 * description doesn't contain a clear signal. The bill form's
 * product-default conversion still fills in a reasonable value when
 * we return null here.
 *
 * No server-only imports — safe for test runner.
 */

const PATTERNS: ReadonlyArray<{ pattern: RegExp; group: number }> = [
  // "12 (12 oz) packets per case", "24 (11 oz) cans per case"
  { pattern: /(\d+)\s*\([^)]*\)\s*(?:cans?|bottles?|packets?|pieces?|items?|cups?|jars?|bags?|each|ea)\b[^.]*?per\s+(?:case|cs|carton|pack)\b/i, group: 1 },
  // "12 cans per case", "24 packets per case", "4 gallons per case"
  { pattern: /(\d+)\s+(?:cans?|bottles?|packets?|pieces?|items?|cups?|jars?|bags?|each|ea|gallons?|gal|liters?|l|fl\s*oz|oz)\s+per\s+(?:case|cs|carton|pack)\b/i, group: 1 },
  // "case of 24", "case of 12"
  { pattern: /case\s+of\s+(\d+)\b/i, group: 1 },
  // "24 PK", "12-pack", "6 pack" (when used as a noun, not "12 PK COKE" alone — but matching "12 PK" anywhere is reasonable)
  { pattern: /\b(\d+)\s*[-\s]?(?:pk|pack)\b/i, group: 1 },
  // "x24" or "x 24" style ("Coke x 24")
  { pattern: /\bx\s*(\d+)\b/i, group: 1 },
];

/**
 * Try to pull a pack size out of a free-text description. Returns null
 * when no pattern matches OR when the parsed number is implausible.
 */
export function extractPackSizeFromDescription(
  description: string | null | undefined,
): number | null {
  if (!description) return null;
  const text = description.trim();
  if (!text) return null;

  for (const { pattern, group } of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[group];
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    // Same bounds as the prior AI sanitizer: positive integer, capped
    // at 10,000 (a case of >10k is almost certainly a misread).
    if (n < 1 || n > 10_000) continue;
    return Math.round(n);
  }
  return null;
}
