import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeAiOverDeterministic, mergeVisionOverResult } from "./ai-merge";
import type { AiExtractionResult } from "../services/ai-provider";
import type { VisionExtractionResult } from "../services/ai-vision";
import type { SupplierInvoicePdfPrefillResult } from "./pdf-prefill";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function emptyDeterministicResult(): SupplierInvoicePdfPrefillResult {
  return {
    values: {
      supplierId: "",
      invoiceNumber: "",
      invoiceDate: "",
      receiveDate: "",
      paymentMethod: null,
      notes: "",
      lines: [],
    },
    warnings: [],
    unmatchedSupplierCandidates: [],
    unmatchedLineDescriptions: [],
    sourceFilename: "invoice.pdf",
    totalComparison: {
      extractedTotal: "160.00",
      computedLineTotal: "0.00",
      variance: null,
      matches: false,
    },
  };
}

function aiResult(overrides: Partial<AiExtractionResult> = {}): AiExtractionResult {
  return {
    supplierName: null,
    invoiceNumber: "12345",
    invoiceDate: "2026-05-01",
    totalAmount: 160,
    subtotal: 160,
    fees: [],
    lines: [],
    confidence: 80,
    warnings: [],
    reasoning: "",
    ...overrides,
  };
}

function visionResult(overrides: Partial<VisionExtractionResult> = {}): VisionExtractionResult {
  return {
    supplierName: null,
    invoiceNumber: "12345",
    invoiceDate: "2026-05-01",
    totalAmount: 160,
    subtotal: 160,
    fees: [],
    lines: [],
    confidence: 85,
    warnings: [],
    reasoning: "",
    visionUsed: true,
    rawVisionJson: "{}",
    ...overrides,
  };
}

const SUPPLIERS = [
  { id: "sup-1", name: "SUMMIT TRADING" },
  { id: "sup-2", name: "Brewer Livestock" },
];

// ---------------------------------------------------------------------------
// End-to-end: AI returns lineTotal+unitPrice but null weight → form has weight
// ---------------------------------------------------------------------------

test("mergeAiOverDeterministic: back-calcs weight when AI returned null quantityWeight", () => {
  const det = emptyDeterministicResult();
  const ai = aiResult({
    supplierName: "SUMMIT TRADING",
    lines: [
      {
        vendorProductName: "CHICKEN TENDERS",
        quantityCases: 4,
        quantityWeight: null,
        caseWeights: null,
        unitPrice: 2,
        lineTotal: 160,
        unitType: "catch_weight",
        notes: null,
      },
    ],
  });

  const { result, backCalcCount, manualCount } = mergeAiOverDeterministic(det, ai, SUPPLIERS);

  assert.equal(result.values.lines.length, 1);
  assert.equal(result.values.lines[0].weightLbs, "80", "weight = 160 / 2");
  assert.equal(result.values.lines[0].unitPrice, "2");
  assert.equal(result.values.lines[0].quantityCases, "4");
  assert.equal(result.values.lines[0].weightEntryMode, "total_weight");
  assert.equal(backCalcCount, 1);
  assert.equal(manualCount, 0);
  assert.equal(result.values.supplierId, "sup-1", "supplier matched from AI name");
  assert.ok(
    result.warnings.some(w => w.includes("Weight back-calculated")),
    "warning surfaced",
  );

  // After back-calc the computed total reconciles with the extracted total.
  assert.equal(result.totalComparison.matches, true);
});

// ---------------------------------------------------------------------------
// End-to-end: per-case weights flow into manual_case_weights mode
// ---------------------------------------------------------------------------

test("mergeAiOverDeterministic: per-case weights populate manual entries", () => {
  const det = emptyDeterministicResult();
  const ai = aiResult({
    supplierName: "SUMMIT TRADING",
    lines: [
      {
        vendorProductName: "BRISKET",
        quantityCases: 5,
        quantityWeight: 115.8,
        caseWeights: [22.5, 23.1, 22.8, 24, 23.4],
        unitPrice: 4,
        lineTotal: 463.2,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    totalAmount: 463.2,
  });

  const { result, backCalcCount, manualCount } = mergeAiOverDeterministic(det, ai, SUPPLIERS);

  assert.equal(result.values.lines[0].weightEntryMode, "manual_case_weights");
  assert.deepEqual(result.values.lines[0].caseWeightEntries, ["22.5", "23.1", "22.8", "24", "23.4"]);
  assert.equal(result.values.lines[0].quantityCases, "5");
  assert.equal(result.values.lines[0].weightLbs, "115.8");
  assert.equal(manualCount, 1);
  assert.equal(backCalcCount, 0);
  assert.ok(
    result.warnings.some(w => w.includes("Per-case weights detected")),
    "warning surfaced",
  );
});

// ---------------------------------------------------------------------------
// Supplier sanitization is enforced *upstream* (in validateExtractionResult),
// but mergeAiOverDeterministic must never match a numeric supplierName to a
// real supplier row regardless.
// ---------------------------------------------------------------------------

test("mergeAiOverDeterministic: numeric supplierName never matches a supplier row", () => {
  const det = emptyDeterministicResult();
  // Simulate an AI response that somehow slipped through with a numeric name.
  const ai = aiResult({
    supplierName: "160.00",
    lines: [
      {
        vendorProductName: "ITEM",
        quantityCases: 1,
        quantityWeight: 10,
        caseWeights: null,
        unitPrice: 5,
        lineTotal: 50,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    totalAmount: 50,
  });

  const { result } = mergeAiOverDeterministic(det, ai, SUPPLIERS);
  assert.equal(result.values.supplierId, "", "no false-positive supplier match");
});

// ---------------------------------------------------------------------------
// Vision path: same recoveries apply
// ---------------------------------------------------------------------------

test("mergeVisionOverResult: back-calcs weight from line totals when vision returned null weight", () => {
  const current = emptyDeterministicResult();
  const vision = visionResult({
    supplierName: "Brewer Livestock",
    lines: [
      {
        vendorProductName: "BEEF BRISKET",
        quantityCases: 2,
        quantityWeight: null,
        caseWeights: null,
        unitPrice: 8,
        lineTotal: 240,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    totalAmount: 240,
  });

  const { result, backCalcCount } = mergeVisionOverResult(current, vision, SUPPLIERS);

  assert.equal(result.values.lines.length, 1);
  assert.equal(result.values.lines[0].weightLbs, "30", "weight = 240 / 8");
  assert.equal(backCalcCount, 1);
  assert.equal(result.values.supplierId, "sup-2");
});

test("mergeVisionOverResult: per-case weights propagate into the form", () => {
  const current = emptyDeterministicResult();
  const vision = visionResult({
    lines: [
      {
        vendorProductName: "GOAT (K-30/39.5)",
        quantityCases: 3,
        quantityWeight: 90,
        caseWeights: [29.5, 30.2, 30.3],
        unitPrice: 10,
        lineTotal: 900,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    totalAmount: 900,
  });

  const { result, manualCount } = mergeVisionOverResult(current, vision, SUPPLIERS);

  assert.equal(result.values.lines[0].weightEntryMode, "manual_case_weights");
  assert.deepEqual(result.values.lines[0].caseWeightEntries, ["29.5", "30.2", "30.3"]);
  assert.equal(manualCount, 1);
});

// ---------------------------------------------------------------------------
// Regression: when deterministic already has good lines + matching totals, the
// AI result must NOT clobber them (existing pipeline policy).
// ---------------------------------------------------------------------------

test("mergeAiOverDeterministic: keeps deterministic lines when det totals match", () => {
  const det: SupplierInvoicePdfPrefillResult = {
    ...emptyDeterministicResult(),
    values: {
      ...emptyDeterministicResult().values,
      lines: [
        {
          productId: "prod-1",
          unitType: "catch_weight",
          weightEntryMode: "total_weight",
          quantityCases: "2",
          weightLbs: "50",
          defaultCaseWeightLbs: "",
          caseWeightEntries: ["", ""],
          unitPrice: "2.00",
          lotNumberOverride: "",
          expirationDateOverride: "",
        },
      ],
    },
    unmatchedLineDescriptions: [],
    totalComparison: {
      extractedTotal: "100.00",
      computedLineTotal: "100.00",
      variance: "0.00",
      matches: true,
    },
  };

  const ai = aiResult({
    lines: [
      {
        vendorProductName: "OTHER",
        quantityCases: 1,
        quantityWeight: 5,
        caseWeights: null,
        unitPrice: 99,
        lineTotal: 495,
        unitType: "catch_weight",
        notes: null,
      },
    ],
  });

  const { result, backCalcCount, manualCount } = mergeAiOverDeterministic(det, ai, SUPPLIERS);

  assert.equal(result.values.lines[0].productId, "prod-1", "det line preserved");
  assert.equal(result.values.lines[0].weightLbs, "50");
  assert.equal(backCalcCount, 0);
  assert.equal(manualCount, 0);
});
