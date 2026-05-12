// Pure confidence scoring for vision-based invoice extraction.
// No server-only import — safe to use in tests.

import type { ValidatedExtractionResult } from "./ai-validation";

export type VisionExtractionScore = {
  lineCountValid: boolean;
  totalsReconcile: boolean | null;
  rowAmountsPresent: boolean;
  productNamesPresent: boolean;
  noEmptyRows: boolean;
  score: number;
  penaltyReasons: string[];
};

export function scoreVisionExtraction(
  result: Pick<ValidatedExtractionResult, "lines" | "totalAmount">,
): VisionExtractionScore {
  const lines = result.lines;
  const penaltyReasons: string[] = [];
  let score = 100;

  // Line count — a non-zero invoice with 0 extracted rows is always wrong
  const lineCountValid = lines.length > 0;
  if (!lineCountValid) {
    score -= 40;
    penaltyReasons.push("No line items extracted.");
  }

  // Total reconciliation — computed line totals should match the declared invoice total
  let totalsReconcile: boolean | null = null;
  if (result.totalAmount !== null && result.totalAmount > 0 && lines.length > 0) {
    // When lineTotal is absent, substitute unitPrice × quantityWeight (or × quantityCases).
    // The original line is never mutated — the computed value is for scoring only.
    const computed = lines.reduce((sum, l) => {
      if (l.lineTotal != null) return sum + l.lineTotal;
      if (l.unitPrice != null) {
        if (l.quantityWeight != null) return sum + l.unitPrice * l.quantityWeight;
        if (l.quantityCases != null) return sum + l.unitPrice * l.quantityCases;
      }
      return sum;
    }, 0);
    if (computed > 0) {
      const variance = Math.abs(computed - result.totalAmount) / result.totalAmount;
      totalsReconcile = variance <= 0.02;
      if (!totalsReconcile) {
        score -= 15;
        penaltyReasons.push(
          `Line totals (${computed.toFixed(2)}) don't match invoice total (${result.totalAmount.toFixed(2)}).`,
        );
      }
    }
  }

  // Row-level amounts — at least 70% of rows should have lineTotal OR (unitPrice AND a quantity)
  const linesWithAmounts =
    lines.length === 0
      ? 0
      : lines.filter(
          l =>
            l.lineTotal !== null ||
            (l.unitPrice !== null && (l.quantityWeight !== null || l.quantityCases !== null)),
        ).length;
  const rowAmountsPresent = lines.length === 0 || linesWithAmounts / lines.length >= 0.7;
  if (lines.length > 0 && !rowAmountsPresent) {
    score -= 20;
    penaltyReasons.push(
      `Only ${linesWithAmounts}/${lines.length} lines have amounts — table columns may be misread.`,
    );
  }

  // Product names — at least 70% of rows should have a non-trivial product name
  const linesWithNames =
    lines.length === 0
      ? 0
      : lines.filter(l => l.vendorProductName && l.vendorProductName.trim().length > 1).length;
  const productNamesPresent = lines.length === 0 || linesWithNames / lines.length >= 0.7;
  if (lines.length > 0 && !productNamesPresent) {
    score -= 15;
    penaltyReasons.push(
      `Only ${linesWithNames}/${lines.length} lines have product names.`,
    );
  }

  // Empty rows — rows with a blank or single-char product name are extraction artefacts
  const emptyRows = lines.filter(
    l => !l.vendorProductName || l.vendorProductName.trim().length < 2,
  );
  const noEmptyRows = emptyRows.length === 0;
  if (!noEmptyRows) {
    score -= 10;
    penaltyReasons.push(`${emptyRows.length} empty or near-empty row(s) detected.`);
  }

  return {
    lineCountValid,
    totalsReconcile,
    rowAmountsPresent,
    productNamesPresent,
    noEmptyRows,
    score: Math.max(0, Math.min(100, score)),
    penaltyReasons,
  };
}

// Conservative minimum quality threshold — vision results below this score are
// too likely to have misread columns or product names to be trusted over text.
const MIN_VISION_SCORE_TO_USE = 40;

// Returns true when a vision result is worth preferring over a text-based result
// (more lines extracted and basic quality thresholds met).
export function isVisionExtractionUseful(
  score: VisionExtractionScore,
  currentLineCount: number,
  visionLineCount: number,
): boolean {
  if (visionLineCount === 0) return false;
  if (!score.lineCountValid) return false;
  if (score.score < MIN_VISION_SCORE_TO_USE) return false;
  // Accept vision if it found more lines than the current result, OR
  // current result has nothing and vision found something.
  return visionLineCount > currentLineCount || currentLineCount === 0;
}
