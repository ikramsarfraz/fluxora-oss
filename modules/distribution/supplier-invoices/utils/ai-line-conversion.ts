// Pure conversion from AI-extracted invoice lines into the form's prefill
// shape. No server-only imports — safe for tests.

import type { SupplierInvoicePdfPrefillLine } from "./pdf-prefill";

export type AiLineLike = {
  vendorProductName: string;
  quantityCases: number | null;
  quantityWeight: number | null;
  caseWeights?: number[] | null;
  unitPrice: number | null;
  lineTotal: number | null;
  unitType: "catch_weight" | "fixed_case" | "per_each" | "per_unit" | null;
  /** Optional UOM abbreviation from the AI; passed through to the form. */
  unitOfMeasure?: string | null;
};

export type AiLineConversion = {
  line: SupplierInvoicePdfPrefillLine;
  /** Weight was derived from lineTotal / unitPrice because AI returned null/0. */
  backCalculatedWeight: boolean;
  /** Per-case weights were populated and the line is in manual_case_weights mode. */
  manualCaseWeights: boolean;
};

function formatWeight(weight: number): string {
  const rounded = Number(weight.toFixed(4));
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Convert an AI-extracted line to the form's prefill shape, with two recoveries:
 * 1. If quantityWeight is missing on a catch_weight line but lineTotal and
 *    unitPrice are both present, back-calculate the weight (lineTotal / unitPrice).
 *    Handles the common case where text-only AI loses the weight column on
 *    Qty/Weight invoices.
 * 2. If caseWeights are populated and their count matches quantityCases (or
 *    quantityCases is missing entirely), switch the line to `manual_case_weights`
 *    mode so the form pre-fills per-case entries.
 */
export function convertAiLineToPrefill(line: AiLineLike): AiLineConversion {
  const unitType = line.unitType ?? "catch_weight";
  const caseWeights = (line.caseWeights ?? []).filter(
    w => Number.isFinite(w) && w > 0,
  );
  const purchaseUnitAbbreviation = (line.unitOfMeasure ?? "").trim();

  // Prefer the AI's quantityCases. If absent but per-case weights are present
  // and consistent, derive count from the caseWeights array length.
  let quantityCases = line.quantityCases ?? 0;
  if (
    (!Number.isInteger(quantityCases) || quantityCases <= 0) &&
    caseWeights.length > 0
  ) {
    quantityCases = caseWeights.length;
  }
  if (!Number.isInteger(quantityCases) || quantityCases <= 0) quantityCases = 1;

  // Non-weight modes short-circuit: no weight, no per-case array, no
  // back-calculation. quantityCases acts as the each / unit count.
  if (unitType === "per_each" || unitType === "per_unit") {
    return {
      line: {
        productId: "",
        unitType,
        weightEntryMode: "total_weight",
        quantityCases: String(quantityCases),
        weightLbs: "0",
        defaultCaseWeightLbs: "",
        caseWeightEntries: Array.from(
          { length: Math.max(1, quantityCases) },
          () => "",
        ),
        unitPrice: String(line.unitPrice ?? 0),
        purchaseUnitAbbreviation,
        lotNumberOverride: "",
        expirationDateOverride: "",
      },
      backCalculatedWeight: false,
      manualCaseWeights: false,
    };
  }

  let weight = line.quantityWeight ?? 0;
  let backCalculatedWeight = false;

  // If the model reported a usable per-case array but no total, derive the
  // total from the per-case sum.
  if (
    caseWeights.length > 0 &&
    caseWeights.length === quantityCases &&
    !(weight > 0)
  ) {
    weight = caseWeights.reduce((s, w) => s + w, 0);
  }

  // Back-calc total weight from lineTotal / unitPrice for catch-weight lines
  // when both are present but weight is missing — common on Qty/Weight
  // invoices where flat-text extraction loses the weight column.
  if (
    unitType === "catch_weight" &&
    !(weight > 0) &&
    line.lineTotal != null &&
    line.lineTotal > 0 &&
    line.unitPrice != null &&
    line.unitPrice > 0
  ) {
    weight = line.lineTotal / line.unitPrice;
    backCalculatedWeight = true;
  }

  const useManualCaseWeights =
    unitType === "catch_weight" &&
    caseWeights.length > 0 &&
    caseWeights.length === quantityCases;

  const caseWeightEntries = useManualCaseWeights
    ? caseWeights.map(formatWeight)
    : Array.from({ length: Math.max(1, quantityCases) }, () => "");

  return {
    line: {
      productId: "",
      unitType,
      weightEntryMode: useManualCaseWeights ? "manual_case_weights" : "total_weight",
      quantityCases: String(quantityCases),
      weightLbs: weight > 0 ? formatWeight(weight) : "0",
      defaultCaseWeightLbs: "",
      caseWeightEntries,
      unitPrice: String(line.unitPrice ?? 0),
      purchaseUnitAbbreviation,
      lotNumberOverride: "",
      expirationDateOverride: "",
    },
    backCalculatedWeight,
    manualCaseWeights: useManualCaseWeights,
  };
}
