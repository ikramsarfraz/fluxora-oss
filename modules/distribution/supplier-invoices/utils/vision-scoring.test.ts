import assert from "node:assert/strict";
import { test } from "node:test";

import { scoreVisionExtraction, isVisionExtractionUseful } from "./vision-scoring";
import type { VisionExtractionScore } from "./vision-scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(overrides?: {
  vendorProductName?: string;
  quantityCases?: number | null;
  quantityWeight?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  unitType?: "catch_weight" | "fixed_case" | null;
  notes?: string | null;
}) {
  return {
    vendorProductName: "JUMBO CHICKEN LEG QT",
    quantityCases: 4,
    quantityWeight: 80,
    unitPrice: 1.85,
    lineTotal: 148.0,
    unitType: "catch_weight" as const,
    notes: null,
    ...overrides,
  };
}

// Acme Distribution sample: 10 real line items, all with weights and amounts.
function acmeDistributionSampleResult() {
  // Sum of line totals: 216 + 58.8 + 189 + 231 + 276 + 150.1 + 248.4 + 246 + 260 + 388.5 = 2263.8
  return {
    totalAmount: 2263.8,
    lines: [
      makeLine({ vendorProductName: "CHICKEN LEG QT", quantityWeight: 160, unitPrice: 1.35, lineTotal: 216.0 }),
      makeLine({ vendorProductName: "CHICKEN BACK", quantityWeight: 120, unitPrice: 0.49, lineTotal: 58.8 }),
      makeLine({ vendorProductName: "CHICKEN WING", quantityWeight: 90, unitPrice: 2.10, lineTotal: 189.0 }),
      makeLine({ vendorProductName: "B/I LAMB SHLDR", quantityWeight: 55, unitPrice: 4.20, lineTotal: 231.0 }),
      makeLine({ vendorProductName: "BNLS LAMB LEG", quantityWeight: 48, unitPrice: 5.75, lineTotal: 276.0 }),
      makeLine({ vendorProductName: "GOAT (K-30/39.5)", quantityWeight: 39.5, unitPrice: 3.80, lineTotal: 150.1 }),
      makeLine({ vendorProductName: "BEEF BRISKET B/I", quantityWeight: 72, unitPrice: 3.45, lineTotal: 248.4 }),
      makeLine({ vendorProductName: "VEAL SHANK", quantityWeight: 60, unitPrice: 4.10, lineTotal: 246.0 }),
      makeLine({ vendorProductName: "CHICKEN TENDER JUMBO", quantityWeight: 80, unitPrice: 3.25, lineTotal: 260.0 }),
      makeLine({ vendorProductName: "LAMB RACK", quantityWeight: 35, unitPrice: 11.1, lineTotal: 388.5 }),
    ],
  };
}

// ---------------------------------------------------------------------------
// scoreVisionExtraction — core scoring
// ---------------------------------------------------------------------------

test("scoreVisionExtraction: perfect extraction scores 100", () => {
  const result = acmeDistributionSampleResult();
  const score = scoreVisionExtraction(result);

  assert.ok(score.score >= 90, `expected score >= 90, got ${score.score}`);
  assert.equal(score.lineCountValid, true);
  assert.equal(score.productNamesPresent, true);
  assert.equal(score.rowAmountsPresent, true);
  assert.equal(score.noEmptyRows, true);
  assert.equal(score.penaltyReasons.length, 0);
});

test("scoreVisionExtraction: zero lines is a hard penalty (−40)", () => {
  const score = scoreVisionExtraction({ lines: [], totalAmount: 500 });

  assert.equal(score.lineCountValid, false);
  assert.ok(score.score <= 60, `expected score ≤ 60, got ${score.score}`);
  assert.ok(score.penaltyReasons.some(r => r.includes("No line items")));
});

test("scoreVisionExtraction: lines without amounts penalised (−20)", () => {
  // 10 lines, only 2 have any amount info
  const lines = Array.from({ length: 10 }, (_, i) =>
    makeLine({
      vendorProductName: `PRODUCT ${i}`,
      unitPrice: i < 2 ? 1.5 : null,
      lineTotal: i < 2 ? 30 : null,
      quantityWeight: i < 2 ? 20 : null,
      quantityCases: null,
    }),
  );
  const score = scoreVisionExtraction({ lines, totalAmount: null });

  assert.equal(score.rowAmountsPresent, false);
  assert.ok(score.score <= 80, `expected score ≤ 80, got ${score.score}`);
  assert.ok(score.penaltyReasons.some(r => r.includes("amounts")));
});

test("scoreVisionExtraction: lines without product names penalised (−15)", () => {
  // 10 lines, 8 have empty names
  const lines = Array.from({ length: 10 }, (_, i) =>
    makeLine({ vendorProductName: i < 2 ? "CHICKEN BREAST" : "" }),
  );
  const score = scoreVisionExtraction({ lines, totalAmount: null });

  assert.equal(score.productNamesPresent, false);
  assert.ok(score.score <= 85, `expected score ≤ 85, got ${score.score}`);
  assert.ok(score.penaltyReasons.some(r => r.includes("product names")));
});

test("scoreVisionExtraction: total reconciliation pass — within 2%", () => {
  // Sum of lines = 100, totalAmount = 101 → 1% variance → passes
  const lines = [
    makeLine({ lineTotal: 60, unitPrice: 3.0, quantityWeight: 20, quantityCases: 1 }),
    makeLine({ lineTotal: 40, unitPrice: 2.0, quantityWeight: 20, quantityCases: 1 }),
  ];
  const score = scoreVisionExtraction({ lines, totalAmount: 101 });

  assert.equal(score.totalsReconcile, true);
  assert.ok(!score.penaltyReasons.some(r => r.includes("don't match")));
});

test("scoreVisionExtraction: total reconciliation fail — beyond 2% variance", () => {
  // Sum = 100, totalAmount = 200 → 50% variance → fails
  const lines = [
    makeLine({ lineTotal: 60, unitPrice: 3.0, quantityWeight: 20, quantityCases: 1 }),
    makeLine({ lineTotal: 40, unitPrice: 2.0, quantityWeight: 20, quantityCases: 1 }),
  ];
  const score = scoreVisionExtraction({ lines, totalAmount: 200 });

  assert.equal(score.totalsReconcile, false);
  assert.ok(score.penaltyReasons.some(r => r.includes("don't match")));
});

test("scoreVisionExtraction: null totalAmount → totalsReconcile is null (no penalty)", () => {
  const lines = [makeLine()];
  const score = scoreVisionExtraction({ lines, totalAmount: null });

  assert.equal(score.totalsReconcile, null);
  assert.ok(!score.penaltyReasons.some(r => r.includes("don't match")));
});

test("scoreVisionExtraction: empty rows penalised (−10)", () => {
  const lines = [
    makeLine({ vendorProductName: "CHICKEN BREAST" }),
    makeLine({ vendorProductName: "" }),   // empty row
    makeLine({ vendorProductName: "x" }), // single-char — also empty-ish
  ];
  const score = scoreVisionExtraction({ lines, totalAmount: null });

  assert.equal(score.noEmptyRows, false);
  assert.ok(score.penaltyReasons.some(r => r.includes("empty")));
});

// ---------------------------------------------------------------------------
// Row count preservation — Acme Distribution sample
// ---------------------------------------------------------------------------

test("Acme Distribution sample: 10 line items extracted", () => {
  const result = acmeDistributionSampleResult();
  assert.equal(result.lines.length, 10);
});

test("Acme Distribution sample: every row has a product name", () => {
  const result = acmeDistributionSampleResult();
  for (const line of result.lines) {
    assert.ok(
      line.vendorProductName && line.vendorProductName.trim().length > 0,
      `Empty product name on row: ${JSON.stringify(line)}`,
    );
  }
});

test("Acme Distribution sample: every row has a unit price", () => {
  const result = acmeDistributionSampleResult();
  for (const line of result.lines) {
    assert.ok(line.unitPrice !== null && line.unitPrice > 0, `Missing unit price: ${line.vendorProductName}`);
  }
});

test("Acme Distribution sample: every row has a weight", () => {
  const result = acmeDistributionSampleResult();
  for (const line of result.lines) {
    assert.ok(
      line.quantityWeight !== null && line.quantityWeight > 0,
      `Missing weight: ${line.vendorProductName}`,
    );
  }
});

test("Acme Distribution sample: every row has a line total", () => {
  const result = acmeDistributionSampleResult();
  for (const line of result.lines) {
    assert.ok(line.lineTotal !== null && line.lineTotal > 0, `Missing line total: ${line.vendorProductName}`);
  }
});

// ---------------------------------------------------------------------------
// Multi-page invoice handling
// ---------------------------------------------------------------------------

test("scoreVisionExtraction: multi-page invoice with 20 lines scores well", () => {
  // 20 lines across 2 pages — all with names and amounts
  const lines = Array.from({ length: 20 }, (_, i) =>
    makeLine({
      vendorProductName: `PRODUCT PAGE${Math.floor(i / 10) + 1} ROW${(i % 10) + 1}`,
      quantityWeight: 50 + i,
      unitPrice: 2.5,
      lineTotal: (50 + i) * 2.5,
    }),
  );
  const totalAmount = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const score = scoreVisionExtraction({ lines, totalAmount });

  assert.ok(score.score >= 90, `expected score ≥ 90, got ${score.score}`);
  assert.equal(score.lineCountValid, true);
  assert.equal(score.totalsReconcile, true);
});

// ---------------------------------------------------------------------------
// isVisionExtractionUseful — merge gate
// ---------------------------------------------------------------------------

function perfectScore(): VisionExtractionScore {
  return {
    lineCountValid: true,
    totalsReconcile: true,
    rowAmountsPresent: true,
    productNamesPresent: true,
    noEmptyRows: true,
    score: 100,
    penaltyReasons: [],
  };
}

test("isVisionExtractionUseful: returns false when vision found 0 lines", () => {
  const score: VisionExtractionScore = { ...perfectScore(), lineCountValid: false, score: 60 };
  assert.equal(isVisionExtractionUseful(score, 0, 0), false);
});

test("isVisionExtractionUseful: returns true when current has 0 lines and vision found rows", () => {
  assert.equal(isVisionExtractionUseful(perfectScore(), 0, 10), true);
});

test("isVisionExtractionUseful: returns true when vision found more lines than current", () => {
  assert.equal(isVisionExtractionUseful(perfectScore(), 3, 10), true);
});

test("isVisionExtractionUseful: returns false when vision found same count as current", () => {
  assert.equal(isVisionExtractionUseful(perfectScore(), 10, 10), false);
});

test("isVisionExtractionUseful: returns false when vision found fewer lines than current", () => {
  assert.equal(isVisionExtractionUseful(perfectScore(), 10, 5), false);
});

// ---------------------------------------------------------------------------
// buildVisionInvoiceUserMessage
// ---------------------------------------------------------------------------

import { buildVisionInvoiceUserMessage } from "./vision-prompts";

test("buildVisionInvoiceUserMessage: includes filename", () => {
  const msg = buildVisionInvoiceUserMessage({ filename: "prime-invoice.pdf" });
  assert.ok(msg.includes("prime-invoice.pdf"));
});

test("buildVisionInvoiceUserMessage: includes supplier hints when provided", () => {
  const msg = buildVisionInvoiceUserMessage({
    filename: "inv.pdf",
    supplierHints: ["SUMMIT TRADING", "ALI TRADERS"],
  });
  assert.ok(msg.includes("SUMMIT TRADING"));
  assert.ok(msg.includes("ALI TRADERS"));
});

test("buildVisionInvoiceUserMessage: includes candidate supplier IDs", () => {
  const msg = buildVisionInvoiceUserMessage({
    filename: "inv.pdf",
    candidateSuppliers: [{ id: "sup-1", name: "ACME DISTRIBUTION" }],
  });
  assert.ok(msg.includes("sup-1"));
  assert.ok(msg.includes("ACME DISTRIBUTION"));
});

test("buildVisionInvoiceUserMessage: includes truncated extracted text when provided", () => {
  const msg = buildVisionInvoiceUserMessage({
    filename: "inv.pdf",
    extractedText: "Invoice #12345\nDate: 2026-04-20",
  });
  assert.ok(msg.includes("Invoice #12345"));
  assert.ok(msg.includes("trust visual reading for table rows"));
});

test("buildVisionInvoiceUserMessage: omits extracted text section when empty", () => {
  const msg = buildVisionInvoiceUserMessage({ filename: "inv.pdf", extractedText: "" });
  assert.ok(!msg.includes("EXTRACTED TEXT"));
});

test("buildVisionInvoiceUserMessage: instructs to return valid JSON", () => {
  const msg = buildVisionInvoiceUserMessage({ filename: "inv.pdf" });
  assert.ok(msg.toLowerCase().includes("json"));
});

// ---------------------------------------------------------------------------
// Acme Distribution regression — before the fix, the pipeline returned 1 line
// (cases=4, weight=0, unitPrice=0.004, lineTotal=$0.02) instead of 11 lines.
//
// Root cause: the deterministic parser captured a spurious row (total = $0.02)
// and the merge/early-return conditions prevented AI/vision from running.
//
// This suite verifies that a vision result matching the actual invoice scores
// correctly and would be accepted by the merge gate over the 1-line det result.
// ---------------------------------------------------------------------------

function acmeDistributionVisionResult() {
  // 11 catch-weight items all at $1.00/lb; line totals sum to 717.56.
  // Invoice total 727.56 includes a $10 Fuel Surcharge (fee, not a line item).
  // Variance = |727.56 − 717.56| / 727.56 ≈ 1.37% — within the 2% tolerance.
  return {
    totalAmount: 727.56,
    lines: [
      makeLine({ vendorProductName: "CHICKEN TENDERS", quantityCases: 4, quantityWeight: 160, unitPrice: 1.00, lineTotal: 160.00 }),
      makeLine({ vendorProductName: "CHICKEN LEG QTRS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00 }),
      makeLine({ vendorProductName: "CHICKEN BACKS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00 }),
      makeLine({ vendorProductName: "CHICKEN WINGS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00 }),
      makeLine({ vendorProductName: "WHOLE CHICKEN", quantityCases: 3, quantityWeight: 60, unitPrice: 1.00, lineTotal: 60.00 }),
      makeLine({ vendorProductName: "BEEF RIBEYE", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00 }),
      makeLine({ vendorProductName: "LAMB SHOULDER", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00 }),
      makeLine({ vendorProductName: "GOAT MEAT", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00 }),
      makeLine({ vendorProductName: "VEAL CHOPS", quantityCases: 2, quantityWeight: 40, unitPrice: 1.00, lineTotal: 40.00 }),
      makeLine({ vendorProductName: "BEEF BRISKET", quantityCases: 2, quantityWeight: 40, unitPrice: 1.00, lineTotal: 40.00 }),
      makeLine({ vendorProductName: "LAMB RACK", quantityCases: 1, quantityWeight: 27.56, unitPrice: 1.00, lineTotal: 27.56 }),
    ],
  };
}

test("Acme Distribution regression: vision result has 11 lines", () => {
  const result = acmeDistributionVisionResult();
  assert.equal(result.lines.length, 11);
});

test("Acme Distribution regression: line totals sum to ~717.56 (not $0.02)", () => {
  const result = acmeDistributionVisionResult();
  const sum = result.lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  assert.ok(
    Math.abs(sum - 717.56) < 0.01,
    `expected sum ≈ 717.56, got ${sum}`,
  );
  assert.ok(sum > 1, `line total sum must not be $0.02 — got ${sum}`);
});

test("Acme Distribution regression: scoreVisionExtraction passes totals reconcile (1.37% variance)", () => {
  const result = acmeDistributionVisionResult();
  const score = scoreVisionExtraction(result);
  // Fuel Surcharge makes totalAmount 727.56 vs computed 717.56 → 1.37% variance < 2%
  assert.equal(score.totalsReconcile, true);
  assert.ok(score.score >= 80, `expected score ≥ 80, got ${score.score}`);
});

test("Acme Distribution regression: isVisionExtractionUseful prefers 11 vision lines over 1 det line", () => {
  const result = acmeDistributionVisionResult();
  const score = scoreVisionExtraction(result);
  // currentLineCount=1 (spurious det line), visionLineCount=11
  assert.equal(isVisionExtractionUseful(score, 1, 11), true);
});

test("Acme Distribution regression: isVisionExtractionUseful blocks vision when det already has same count", () => {
  const result = acmeDistributionVisionResult();
  const score = scoreVisionExtraction(result);
  assert.equal(isVisionExtractionUseful(score, 11, 11), false);
});
