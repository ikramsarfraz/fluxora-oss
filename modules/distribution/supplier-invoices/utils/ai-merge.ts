// Pure merge helpers that combine deterministic, AI text, and vision results
// into a single form-ready prefill. No server-only imports so these can run in
// the unit-test runner.

import type { AiExtractionResult } from "../services/ai-provider";
import type { VisionExtractionResult } from "../services/ai-vision";
import { convertAiLineToPrefill } from "./ai-line-conversion";
import type {
  SupplierInvoicePdfPrefillLine,
  SupplierInvoicePdfPrefillResult,
} from "./pdf-prefill";

export type MergeResult = {
  result: SupplierInvoicePdfPrefillResult;
  backCalcCount: number;
  manualCount: number;
};

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(v.trim());
  }
  return result;
}

function lookupSupplierByName(
  supplierName: string | null,
  supplierRows: Array<{ id: string; name: string }>,
): string | null {
  if (!supplierName) return null;
  const normalized = supplierName.toUpperCase();
  const match = supplierRows.find(s => s.name.toUpperCase() === normalized);
  return match?.id ?? null;
}

/**
 * Merge AI text extraction over the deterministic parser's result. The AI
 * lines replace deterministic lines when:
 *   (a) the deterministic parse found nothing real, OR
 *   (b) AI found strictly more lines AND deterministic totals don't reconcile.
 *
 * Always uses `convertAiLineToPrefill` so weight back-calculation and
 * per-case-weight mode behave identically across the text and vision paths.
 */
export function mergeAiOverDeterministic(
  det: SupplierInvoicePdfPrefillResult,
  ai: AiExtractionResult,
  supplierRows: Array<{ id: string; name: string }>,
): MergeResult {
  let supplierId = det.values.supplierId;
  if (!supplierId) {
    supplierId = lookupSupplierByName(ai.supplierName, supplierRows) ?? "";
  }

  const invoiceNumber = det.values.invoiceNumber || ai.invoiceNumber || "";
  const invoiceDate =
    det.values.invoiceDate || ai.invoiceDate || new Date().toISOString().slice(0, 10);

  let lines: SupplierInvoicePdfPrefillLine[] = det.values.lines;
  let unmatchedLineDescriptions = det.unmatchedLineDescriptions;
  let updatedTotalComparison = det.totalComparison;

  const detHasRealLines =
    det.unmatchedLineDescriptions.length > 0 ||
    det.values.lines.some(
      l => Number(l.unitPrice) > 0 || (l.weightLbs && Number(l.weightLbs) > 0),
    );
  const aiHasMoreLines = ai.lines.length > det.values.lines.length;
  const detTotalsOk = det.totalComparison.matches === true;

  let backCalcCount = 0;
  let manualCount = 0;

  if ((!detHasRealLines || (aiHasMoreLines && !detTotalsOk)) && ai.lines.length > 0) {
    const conversions = ai.lines.map(convertAiLineToPrefill);
    lines = conversions.map(c => c.line);
    backCalcCount = conversions.filter(c => c.backCalculatedWeight).length;
    manualCount = conversions.filter(c => c.manualCaseWeights).length;
    unmatchedLineDescriptions = ai.lines.map(l => l.vendorProductName);

    // Recompute totalComparison so downstream scoring sees current line totals.
    // Use the converted prefill weights (which include back-calc) so the totals
    // reconciliation matches what the form will actually display.
    const computedSum = lines.reduce((s, prefill, i) => {
      const aiLine = ai.lines[i];
      if (aiLine?.lineTotal != null) return s + aiLine.lineTotal;
      const price = Number(prefill.unitPrice) || 0;
      if (prefill.unitType === "catch_weight") {
        return s + (Number(prefill.weightLbs) || 0) * price;
      }
      return s + (Number(prefill.quantityCases) || 0) * price;
    }, 0);
    const aiTotal = ai.totalAmount;
    const variance =
      aiTotal != null && aiTotal > 0 && computedSum > 0
        ? Math.abs(aiTotal - computedSum) / aiTotal
        : null;
    updatedTotalComparison = {
      extractedTotal: aiTotal != null ? String(aiTotal) : det.totalComparison.extractedTotal,
      computedLineTotal: computedSum.toFixed(2),
      variance: variance != null ? variance.toFixed(4) : null,
      matches: variance != null ? variance <= 0.02 : null,
    };
  }

  const warnings = [...det.warnings];
  if (ai.warnings.length > 0) warnings.push(...ai.warnings);
  if (backCalcCount > 0) {
    warnings.push(
      `Weight back-calculated from line total / unit price on ${backCalcCount} line(s) — verify before saving.`,
    );
  }
  if (manualCount > 0) {
    warnings.push(
      `Per-case weights detected on ${manualCount} line(s) — review the manual case-weight entries before saving.`,
    );
  }
  if (ai.fees.length > 0) {
    warnings.push(
      `Non-inventory fees detected by AI: ${ai.fees.map(f => f.description).join(", ")}.`,
    );
  }

  return {
    result: {
      ...det,
      values: {
        ...det.values,
        supplierId,
        invoiceNumber,
        invoiceDate,
        receiveDate: invoiceDate,
        lines,
      },
      totalComparison: updatedTotalComparison,
      warnings: dedupeStrings(warnings),
      unmatchedLineDescriptions,
    },
    backCalcCount,
    manualCount,
  };
}

/**
 * Merge vision extraction over an existing prefill result. Always replaces the
 * current lines with the vision-extracted ones (vision is only invoked when
 * the prior result is unsatisfactory).
 */
export function mergeVisionOverResult(
  current: SupplierInvoicePdfPrefillResult,
  vision: VisionExtractionResult,
  supplierRows: Array<{ id: string; name: string }>,
): MergeResult {
  const conversions = vision.lines.map(convertAiLineToPrefill);
  const lines = conversions.map(c => c.line);
  const backCalcCount = conversions.filter(c => c.backCalculatedWeight).length;
  const manualCount = conversions.filter(c => c.manualCaseWeights).length;
  const unmatchedLineDescriptions = vision.lines.map(l => l.vendorProductName);

  let supplierId = current.values.supplierId;
  if (!supplierId) {
    supplierId = lookupSupplierByName(vision.supplierName, supplierRows) ?? "";
  }

  const invoiceNumber = current.values.invoiceNumber || vision.invoiceNumber || "";
  const invoiceDate =
    current.values.invoiceDate || vision.invoiceDate || new Date().toISOString().slice(0, 10);

  // Recompute totalComparison from vision line totals.
  const computedSum = vision.lines.reduce((s, l) => {
    if (l.lineTotal != null) return s + l.lineTotal;
    const price = l.unitPrice ?? 0;
    if (l.unitType === "catch_weight") return s + (l.quantityWeight ?? 0) * price;
    return s + (l.quantityCases ?? 1) * price;
  }, 0);
  const visionTotal = vision.totalAmount;
  const variance =
    visionTotal != null && visionTotal > 0 && computedSum > 0
      ? Math.abs(visionTotal - computedSum) / visionTotal
      : null;
  const updatedTotalComparison = {
    extractedTotal: visionTotal != null ? String(visionTotal) : current.totalComparison.extractedTotal,
    computedLineTotal: computedSum.toFixed(2),
    variance: variance != null ? variance.toFixed(4) : null,
    matches: variance != null ? variance <= 0.02 : null,
  };

  const warnings = dedupeStrings([
    ...current.warnings,
    ...vision.warnings,
    `Vision-based table extraction used — ${vision.lines.length} row(s) extracted visually.`,
  ]);

  if (backCalcCount > 0) {
    warnings.push(
      `Weight back-calculated from line total / unit price on ${backCalcCount} line(s) — verify before saving.`,
    );
  }
  if (manualCount > 0) {
    warnings.push(
      `Per-case weights detected on ${manualCount} line(s) — review the manual case-weight entries before saving.`,
    );
  }
  if (vision.fees.length > 0) {
    warnings.push(
      `Non-inventory fees detected by vision AI: ${vision.fees.map(f => f.description).join(", ")}.`,
    );
  }

  return {
    result: {
      ...current,
      values: {
        ...current.values,
        supplierId,
        invoiceNumber,
        invoiceDate,
        receiveDate: invoiceDate,
        lines,
      },
      totalComparison: updatedTotalComparison,
      warnings,
      unmatchedLineDescriptions,
    },
    backCalcCount,
    manualCount,
  };
}
