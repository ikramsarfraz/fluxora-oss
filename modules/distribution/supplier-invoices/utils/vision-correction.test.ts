import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectQtyWeightHeader,
  correctVisionColumnSwap,
} from "./vision-correction";
import type { AiInvoiceLine } from "../services/ai-provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(overrides: Partial<AiInvoiceLine> & { vendorProductName: string }): AiInvoiceLine {
  return {
    quantityCases: null,
    quantityWeight: null,
    unitPrice: null,
    lineTotal: null,
    unitType: null,
    notes: null,
    ...overrides,
  };
}

// Raw vision output for Acme Distribution invoice — model confused Qty/Weight with Qty.
// Invoice table layout:  Qty | Description | Qty/Weight | Unit Price | Line Total
function primeRawVisionLines(): AiInvoiceLine[] {
  return [
    makeLine({ vendorProductName: "CHICKEN TENDERS",    quantityCases: 160,    quantityWeight: null, unitPrice: 1, lineTotal: 160,    unitType: "fixed_case" }),
    makeLine({ vendorProductName: "BRISKET SHORT RIBS", quantityCases: 69.05,  quantityWeight: null, unitPrice: 1, lineTotal: 69.05,  unitType: "fixed_case" }),
    makeLine({ vendorProductName: "QH-WHOLE CHICKEN",   quantityCases: 76.90,  quantityWeight: null, unitPrice: 1, lineTotal: 76.90,  unitType: "fixed_case" }),
    makeLine({ vendorProductName: "BEEF BRISKET",       quantityCases: 116.55, quantityWeight: null, unitPrice: 1, lineTotal: 116.55, unitType: "fixed_case" }),
  ];
}

const PRIME_EXTRACTED_TEXT = `
Qty  Description          Qty/Weight  Unit Price  Line Total
4    CHICKEN TENDERS      160.00      1.00        160.00
1    BRISKET SHORT RIBS    69.05      1.00         69.05
2    QH-WHOLE CHICKEN      76.90      1.00         76.90
2    BEEF BRISKET         116.55      1.00        116.55
`;

// ---------------------------------------------------------------------------
// detectQtyWeightHeader
// ---------------------------------------------------------------------------

test("detectQtyWeightHeader: detects 'Qty/Weight'", () => {
  assert.equal(detectQtyWeightHeader("Qty  Description  Qty/Weight  Unit Price"), true);
});

test("detectQtyWeightHeader: detects 'Qty / Weight' (with spaces)", () => {
  assert.equal(detectQtyWeightHeader("Qty / Weight"), true);
});

test("detectQtyWeightHeader: detects 'Weight Lbs'", () => {
  assert.equal(detectQtyWeightHeader("Weight Lbs"), true);
});

test("detectQtyWeightHeader: returns false for plain 'Qty' header", () => {
  assert.equal(detectQtyWeightHeader("Qty  Description  Unit Price  Total"), false);
});

// ---------------------------------------------------------------------------
// correctVisionColumnSwap — no-op cases
// ---------------------------------------------------------------------------

test("correctVisionColumnSwap: no-op when lines already correct", () => {
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "CHICKEN TENDERS", quantityCases: 4, quantityWeight: 160, unitPrice: 1, lineTotal: 160, unitType: "catch_weight" }),
  ];
  const { lines: out, correctedCount } = correctVisionColumnSwap(lines, PRIME_EXTRACTED_TEXT);
  assert.equal(correctedCount, 0);
  assert.equal(out[0].quantityCases, 4);
  assert.equal(out[0].quantityWeight, 160);
});

test("correctVisionColumnSwap: no-op on empty lines array", () => {
  const { correctedCount } = correctVisionColumnSwap([], PRIME_EXTRACTED_TEXT);
  assert.equal(correctedCount, 0);
});

test("correctVisionColumnSwap: no-op when no Qty/Weight header and no decimal cases", () => {
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "BOX CHICKEN", quantityCases: 10, quantityWeight: null, unitPrice: 45, lineTotal: 450, unitType: "fixed_case" }),
  ];
  const { correctedCount } = correctVisionColumnSwap(lines, "Qty Description Unit Price Total");
  assert.equal(correctedCount, 0);
});

// ---------------------------------------------------------------------------
// correctVisionColumnSwap — decimal cases trigger (task 4)
// ---------------------------------------------------------------------------

test("decimal quantityCases triggers correction (69.05 → quantityWeight)", () => {
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "BRISKET SHORT RIBS", quantityCases: 69.05, quantityWeight: null, unitPrice: 1, lineTotal: 69.05, unitType: "fixed_case" }),
  ];
  const { lines: out, correctedCount } = correctVisionColumnSwap(lines);
  assert.equal(correctedCount, 1);
  assert.equal(out[0].quantityWeight, 69.05);
  assert.equal(out[0].quantityCases, 1);
  assert.equal(out[0].unitType, "catch_weight");
});

test("decimal cases correction works even without extracted text", () => {
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "QH-WHOLE CHICKEN", quantityCases: 76.90, quantityWeight: null, unitPrice: 1, lineTotal: 76.90, unitType: "fixed_case" }),
  ];
  const { correctedCount } = correctVisionColumnSwap(lines);
  assert.equal(correctedCount, 1);
});

// ---------------------------------------------------------------------------
// correctVisionColumnSwap — header-based correction (integer cases still wrong)
// ---------------------------------------------------------------------------

test("integer cases corrected when Qty/Weight header present and weight is null", () => {
  // CHICKEN TENDERS: quantityCases=160 is integer but still wrong — weight column was read
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "CHICKEN TENDERS", quantityCases: 160, quantityWeight: null, unitPrice: 1, lineTotal: 160, unitType: "fixed_case" }),
  ];
  const { lines: out, correctedCount } = correctVisionColumnSwap(lines, PRIME_EXTRACTED_TEXT);
  assert.equal(correctedCount, 1);
  assert.equal(out[0].quantityWeight, 160);
  assert.equal(out[0].quantityCases, 1);
  assert.equal(out[0].unitType, "catch_weight");
});

// ---------------------------------------------------------------------------
// Acme Distribution regression — all 4 lines corrected (task 5)
// ---------------------------------------------------------------------------

test("Acme Distribution: all 4 lines are corrected", () => {
  const { lines: out, correctedCount } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  assert.equal(correctedCount, 4);
  assert.equal(out.length, 4);
});

test("Acme Distribution: CHICKEN TENDERS — cases=1, weight=160", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  const line = out.find(l => l.vendorProductName === "CHICKEN TENDERS")!;
  assert.equal(line.quantityCases, 1);
  assert.equal(line.quantityWeight, 160);
  assert.equal(line.unitType, "catch_weight");
});

test("Acme Distribution: BRISKET SHORT RIBS — cases=1, weight=69.05", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  const line = out.find(l => l.vendorProductName === "BRISKET SHORT RIBS")!;
  assert.equal(line.quantityCases, 1);
  assert.ok(Math.abs(line.quantityWeight! - 69.05) < 0.001);
  assert.equal(line.unitType, "catch_weight");
});

test("Acme Distribution: QH-WHOLE CHICKEN — cases=1, weight=76.90", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  const line = out.find(l => l.vendorProductName === "QH-WHOLE CHICKEN")!;
  assert.equal(line.quantityCases, 1);
  assert.ok(Math.abs(line.quantityWeight! - 76.90) < 0.001);
  assert.equal(line.unitType, "catch_weight");
});

test("Acme Distribution: BEEF BRISKET — cases=1, weight=116.55", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  const line = out.find(l => l.vendorProductName === "BEEF BRISKET")!;
  assert.equal(line.quantityCases, 1);
  assert.ok(Math.abs(line.quantityWeight! - 116.55) < 0.001);
  assert.equal(line.unitType, "catch_weight");
});

test("Acme Distribution: all corrected lines have unitType catch_weight", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  for (const line of out) {
    assert.equal(line.unitType, "catch_weight", `${line.vendorProductName} has wrong unitType`);
  }
});

test("Acme Distribution: warning message mentions corrected count", () => {
  const { warnings } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("4 line(s)"), `expected '4 line(s)' in warning: ${warnings[0]}`);
});

test("Acme Distribution: unitPrice and lineTotal preserved after correction", () => {
  const { lines: out } = correctVisionColumnSwap(primeRawVisionLines(), PRIME_EXTRACTED_TEXT);
  for (const line of out) {
    assert.equal(line.unitPrice, 1, `${line.vendorProductName} unitPrice should be 1`);
    assert.ok(line.lineTotal !== null, `${line.vendorProductName} lineTotal should not be null`);
  }
});

// ---------------------------------------------------------------------------
// Mixed invoice: decimal lines trigger correction, integer-cases-only lines
// without null-weight are left alone
// ---------------------------------------------------------------------------

test("mixed invoice: only swapped lines are corrected, intact lines left alone", () => {
  const lines: AiInvoiceLine[] = [
    // Swapped: decimal cases
    makeLine({ vendorProductName: "LAMB RACK",    quantityCases: 27.56, quantityWeight: null, unitPrice: 1, lineTotal: 27.56, unitType: "fixed_case" }),
    // Correct: already has weight
    makeLine({ vendorProductName: "FROZEN BOX",  quantityCases: 5,     quantityWeight: null, unitPrice: 45, lineTotal: 225,  unitType: "fixed_case" }),
  ];
  const { lines: out, correctedCount } = correctVisionColumnSwap(lines, "Qty Description Unit Price Total");
  // decimal cases trigger pattern detection; FROZEN BOX has no decimal cases
  // but because pattern is confirmed, check if FROZEN BOX is untouched
  // (FROZEN BOX has null weight — but no Qty/Weight header, so pattern only from decimal)
  // Actually with no Qty/Weight header: only decimal-cases lines are corrected individually
  assert.equal(correctedCount, 1);
  assert.equal(out[0].quantityWeight, 27.56);
  assert.equal(out[0].quantityCases, 1);
  // FROZEN BOX untouched
  assert.equal(out[1].quantityCases, 5);
  assert.equal(out[1].quantityWeight, null);
  assert.equal(out[1].unitType, "fixed_case");
});

// ---------------------------------------------------------------------------
// Partial column swap: header present, only SOME lines have null weight
// ---------------------------------------------------------------------------

test("partial swap: one integer-cases line corrected when header present and 50%+ lines swapped", () => {
  // Simulates: vision correctly extracted weight on line 1, but line 2 had integer weight
  // read into cases instead. The "every" gate would miss line 2; majority gate catches it.
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "CHICKEN BREAST", quantityCases: 4,   quantityWeight: 92.5, unitPrice: 2.10, lineTotal: 194.25, unitType: "catch_weight" }),
    makeLine({ vendorProductName: "BEEF BRISKET",   quantityCases: 116, quantityWeight: null, unitPrice: 4.20, lineTotal: 487.20, unitType: "fixed_case" }),
  ];
  const extractedText = "Qty Description Qty/Weight Rate Amount";
  const { lines: out, correctedCount } = correctVisionColumnSwap(lines, extractedText);
  // Line 1 already correct → untouched
  assert.equal(out[0].quantityCases, 4);
  assert.equal(out[0].quantityWeight, 92.5);
  // Line 2 swapped → corrected
  assert.equal(correctedCount, 1);
  assert.equal(out[1].quantityWeight, 116);
  assert.equal(out[1].quantityCases, 1);
  assert.equal(out[1].unitType, "catch_weight");
});

test("partial swap: no correction when header present but <50% lines are swapped", () => {
  // 1 swapped out of 4 = 25% — below threshold, don't risk false-positive correction
  const lines: AiInvoiceLine[] = [
    makeLine({ vendorProductName: "A", quantityCases: 2, quantityWeight: 40.0, unitPrice: 3.00, lineTotal: 120.0, unitType: "catch_weight" }),
    makeLine({ vendorProductName: "B", quantityCases: 3, quantityWeight: 60.0, unitPrice: 2.50, lineTotal: 150.0, unitType: "catch_weight" }),
    makeLine({ vendorProductName: "C", quantityCases: 4, quantityWeight: 80.0, unitPrice: 2.00, lineTotal: 160.0, unitType: "catch_weight" }),
    makeLine({ vendorProductName: "D", quantityCases: 75, quantityWeight: null, unitPrice: 1.50, lineTotal: 112.5, unitType: "fixed_case" }),
  ];
  const { correctedCount } = correctVisionColumnSwap(lines, "Qty Description Qty/Weight Rate Amount");
  assert.equal(correctedCount, 0);
});
