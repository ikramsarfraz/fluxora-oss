// Pure heuristics for correcting common column-mapping errors in vision extraction.
// No server-only import — safe to use in tests.

import type { AiInvoiceLine } from "../services/ai-provider";

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

export function detectQtyWeightHeader(extractedText: string): boolean {
  return /qty\s*[/]\s*weight|qty\/weight|qty\.?\s*wgt|net\s*weight|weight\s*lbs/i.test(extractedText);
}

// ---------------------------------------------------------------------------
// Per-line column-swap detection
// ---------------------------------------------------------------------------

// A decimal quantityCases value (e.g. 69.05) is an unambiguous sign that the
// weight column was read instead of the cases column — case counts are always integers.
function hasDecimalCases(line: AiInvoiceLine): boolean {
  return line.quantityCases !== null && !Number.isInteger(line.quantityCases);
}

// When the Qty/Weight header is confirmed, any line that has a non-null cases
// value but a null weight was almost certainly column-swapped.
function hasNullWeightWithCases(line: AiInvoiceLine): boolean {
  return line.quantityWeight === null && line.quantityCases !== null;
}

// ---------------------------------------------------------------------------
// Batch pattern detection
// ---------------------------------------------------------------------------

// Returns true when there is enough evidence to correct the whole set of lines.
function isColumnSwapPattern(lines: AiInvoiceLine[], hasQtyWeightHeader: boolean): boolean {
  if (lines.length === 0) return false;

  const decimalCaseCount = lines.filter(hasDecimalCases).length;
  if (decimalCaseCount > 0) return true;

  // Header + majority of lines missing weight → full or partial column swap.
  // "every" is too strict: on mixed invoices where some lines were extracted
  // correctly, one remaining swapped integer-cases line would never be fixed.
  // 50% threshold is enough evidence without over-triggering on fixed-case invoices.
  if (hasQtyWeightHeader && lines.length > 0) {
    const swappedCount = lines.filter(
      l => l.quantityWeight === null && l.quantityCases !== null,
    ).length;
    if (swappedCount / lines.length >= 0.5) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export type ColumnSwapCorrectionResult = {
  lines: AiInvoiceLine[];
  correctedCount: number;
  warnings: string[];
};

/**
 * Detects the common "Qty/Weight column read as Qty" mistake and corrects it.
 *
 * When vision reads a table like:
 *   Qty | Description | Qty/Weight | Unit Price | Total
 *   4   | Chicken     | 160.00     | 1.00       | 160.00
 *
 * It sometimes returns quantityCases=160, quantityWeight=null instead of
 * quantityCases=4, quantityWeight=160. This function fixes that.
 *
 * The actual Qty value cannot be recovered from the AI response, so corrected
 * lines default quantityCases to 1 — user must verify case counts.
 */
export function correctVisionColumnSwap(
  lines: AiInvoiceLine[],
  extractedText?: string,
): ColumnSwapCorrectionResult {
  const hasQtyWeightHeader = extractedText ? detectQtyWeightHeader(extractedText) : false;

  if (!isColumnSwapPattern(lines, hasQtyWeightHeader)) {
    return { lines, correctedCount: 0, warnings: [] };
  }

  let correctedCount = 0;

  const correctedLines = lines.map((line): AiInvoiceLine => {
    const needs = hasDecimalCases(line) || (hasQtyWeightHeader && hasNullWeightWithCases(line));
    if (!needs) return line;

    correctedCount++;
    return {
      ...line,
      quantityWeight: line.quantityCases,
      quantityCases: 1,
      unitType: "catch_weight",
    };
  });

  const warnings: string[] =
    correctedCount > 0
      ? [
          `Qty/Weight column swap corrected on ${correctedCount} line(s): ` +
            `weight recovered from cases field; case counts defaulted to 1 — verify before saving.`,
        ]
      : [];

  return { lines: correctedLines, correctedCount, warnings };
}
