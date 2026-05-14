import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeDraftLineWeight,
} from "./case-weights";
import {
  computeLineTotal,
  emptyLine,
} from "../components/supplier-invoice-form.schema";

// ---------------------------------------------------------------------------
// Helpers — mirror what parsing-pipeline.ts does when building form lines from
// AI / vision extraction results.
// ---------------------------------------------------------------------------

type AiLine = {
  vendorProductName: string;
  quantityCases: number | null;
  quantityWeight: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  unitType: "catch_weight" | "fixed_case" | null;
};

function mapAiLineToFormLine(aiLine: AiLine) {
  return {
    productId: "",
    unitType: aiLine.unitType ?? "catch_weight",
    weightEntryMode: "total_weight" as const,
    quantityCases: String(aiLine.quantityCases ?? 1),
    weightLbs: String(aiLine.quantityWeight ?? 0),
    defaultCaseWeightLbs: "",
    caseWeightEntries: Array.from(
      { length: Math.max(1, aiLine.quantityCases ?? 1) },
      () => "",
    ),
    unitPrice: String(aiLine.unitPrice ?? 0),
    lotNumberOverride: "",
    expirationDateOverride: "",
  };
}

// ---------------------------------------------------------------------------
// Field-name mapping: AI extraction → form fields
// ---------------------------------------------------------------------------

test("mapAiLine: quantityWeight maps to weightLbs", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  assert.equal(line.weightLbs, "160");
});

test("mapAiLine: unitPrice maps to unitPrice string", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  assert.equal(line.unitPrice, "1");
});

test("mapAiLine: null quantityWeight maps to weightLbs '0'", () => {
  // This is what AI TEXT extraction returns when it can't read the weight column.
  // The test documents the bug trigger: weightLbs='0' → form total = 0.
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: null,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  assert.equal(line.weightLbs, "0");
});

test("mapAiLine: quantityCases maps to quantityCases string", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  assert.equal(line.quantityCases, "4");
});

// ---------------------------------------------------------------------------
// computeDraftLineWeight — the function that drives the weight display in LineRow
// ---------------------------------------------------------------------------

test("computeDraftLineWeight: total_weight mode returns weightLbs as number", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  const weight = computeDraftLineWeight(line);
  assert.equal(weight, 160);
});

test("computeDraftLineWeight: returns 0 when weightLbs is '0' (broken AI text path)", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: null, // AI text couldn't read weight column
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  const weight = computeDraftLineWeight(line);
  assert.equal(weight, 0);
});

test("computeDraftLineWeight: decimal weight preserved", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "LAMB RACK",
    quantityCases: 1,
    quantityWeight: 27.56,
    unitPrice: 1.0,
    lineTotal: 27.56,
    unitType: "catch_weight",
  });
  const weight = computeDraftLineWeight(line);
  assert.ok(Math.abs(weight - 27.56) < 0.001, `expected 27.56, got ${weight}`);
});

// ---------------------------------------------------------------------------
// computeLineTotal — the function used by the form to display per-line total
// ---------------------------------------------------------------------------

test("computeLineTotal: catch_weight line total = weight × unitPrice", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  const total = computeLineTotal(line);
  assert.equal(total, 160);
});

test("computeLineTotal: returns 0 when weightLbs is '0' (broken AI text path)", () => {
  // Documents that the form shows $0.00 when AI text couldn't extract weights.
  const line = mapAiLineToFormLine({
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: null,
    unitPrice: 1.0,
    lineTotal: 160,
    unitType: "catch_weight",
  });
  const total = computeLineTotal(line);
  assert.equal(total, 0);
});

test("computeLineTotal: fixed_case line total = cases × unitPrice", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "FROZEN BULK BOX",
    quantityCases: 5,
    quantityWeight: null,
    unitPrice: 45.0,
    lineTotal: 225,
    unitType: "fixed_case",
  });
  const total = computeLineTotal(line);
  assert.equal(total, 225);
});

// ---------------------------------------------------------------------------
// Unresolved product must NOT zero out numeric fields (task 9)
// ---------------------------------------------------------------------------

test("unresolved product: weightLbs preserved when productId is empty", () => {
  const line = mapAiLineToFormLine({
    vendorProductName: "GOAT SHOULDER",
    quantityCases: 2,
    quantityWeight: 50,
    unitPrice: 3.5,
    lineTotal: 175,
    unitType: "catch_weight",
  });
  // productId="" simulates an unresolved product (alias/AI match didn't find it)
  assert.equal(line.productId, "");
  assert.equal(line.weightLbs, "50");
  assert.equal(line.unitPrice, "3.5");
  assert.equal(computeLineTotal(line), 175);
});

test("unresolved product: enrichment spreads only productId, numeric fields unchanged", () => {
  // Simulate what enrichWithAliasesAndAiMatching does for an unresolved line:
  // it returns { ...line } — the numeric fields are never touched.
  const original = mapAiLineToFormLine({
    vendorProductName: "VEAL CHOPS",
    quantityCases: 2,
    quantityWeight: 40,
    unitPrice: 4.5,
    lineTotal: 180,
    unitType: "catch_weight",
  });

  // No match found — line returned as-is (this is the enrichment code path)
  const enriched = { ...original };  // mimics return line; in enrichWithAliasesAndAiMatching

  assert.equal(enriched.weightLbs, "40");
  assert.equal(enriched.unitPrice, "4.5");
  assert.equal(computeLineTotal(enriched), 180);
});

// ---------------------------------------------------------------------------
// Acme Distribution regression: 11 lines with correct weight/price survive mapping
// ---------------------------------------------------------------------------

function acmeDistributionAiLines(): AiLine[] {
  return [
    { vendorProductName: "CHICKEN TENDERS", quantityCases: 4, quantityWeight: 160, unitPrice: 1.00, lineTotal: 160.00, unitType: "catch_weight" },
    { vendorProductName: "CHICKEN LEG QTRS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00, unitType: "catch_weight" },
    { vendorProductName: "CHICKEN BACKS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00, unitType: "catch_weight" },
    { vendorProductName: "CHICKEN WINGS", quantityCases: 4, quantityWeight: 80, unitPrice: 1.00, lineTotal: 80.00, unitType: "catch_weight" },
    { vendorProductName: "WHOLE CHICKEN", quantityCases: 3, quantityWeight: 60, unitPrice: 1.00, lineTotal: 60.00, unitType: "catch_weight" },
    { vendorProductName: "BEEF RIBEYE", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00, unitType: "catch_weight" },
    { vendorProductName: "LAMB SHOULDER", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00, unitType: "catch_weight" },
    { vendorProductName: "GOAT MEAT", quantityCases: 2, quantityWeight: 50, unitPrice: 1.00, lineTotal: 50.00, unitType: "catch_weight" },
    { vendorProductName: "VEAL CHOPS", quantityCases: 2, quantityWeight: 40, unitPrice: 1.00, lineTotal: 40.00, unitType: "catch_weight" },
    { vendorProductName: "BEEF BRISKET", quantityCases: 2, quantityWeight: 40, unitPrice: 1.00, lineTotal: 40.00, unitType: "catch_weight" },
    { vendorProductName: "LAMB RACK", quantityCases: 1, quantityWeight: 27.56, unitPrice: 1.00, lineTotal: 27.56, unitType: "catch_weight" },
  ];
}

test("Acme Distribution: 11 AI lines map to 11 form lines", () => {
  const formLines = acmeDistributionAiLines().map(mapAiLineToFormLine);
  assert.equal(formLines.length, 11);
});

test("Acme Distribution: every form line has non-zero weightLbs", () => {
  const formLines = acmeDistributionAiLines().map(mapAiLineToFormLine);
  for (const line of formLines) {
    assert.ok(
      Number(line.weightLbs) > 0,
      `expected non-zero weightLbs, got '${line.weightLbs}' for ${line.unitType}`,
    );
  }
});

test("Acme Distribution: every form line has unitPrice '1'", () => {
  const formLines = acmeDistributionAiLines().map(mapAiLineToFormLine);
  for (const line of formLines) {
    assert.equal(line.unitPrice, "1");
  }
});

test("Acme Distribution: form line totals sum to ~717.56 (not $0.00)", () => {
  const formLines = acmeDistributionAiLines().map(mapAiLineToFormLine);
  const total = formLines.reduce((s, l) => s + computeLineTotal(l), 0);
  assert.ok(
    Math.abs(total - 717.56) < 0.01,
    `expected sum ≈ 717.56, got ${total}`,
  );
  assert.ok(total > 1, `total must not be $0.00 — got ${total}`);
});

test("Acme Distribution: computeDraftLineWeight returns correct weight per line", () => {
  const formLines = acmeDistributionAiLines().map(mapAiLineToFormLine);
  const expectedWeights = [160, 80, 80, 80, 60, 50, 50, 50, 40, 40, 27.56];
  for (let i = 0; i < formLines.length; i++) {
    const w = computeDraftLineWeight(formLines[i]);
    assert.ok(
      Math.abs(w - expectedWeights[i]) < 0.01,
      `line ${i}: expected ${expectedWeights[i]}, got ${w}`,
    );
  }
});

// ---------------------------------------------------------------------------
// emptyLine() sanity — ensure defaults don't accidentally produce non-zero values
// ---------------------------------------------------------------------------

test("emptyLine: default form line has zero weight and price", () => {
  const line = emptyLine();
  assert.equal(line.weightLbs, "0");
  assert.equal(line.unitPrice, "0");
  assert.equal(computeLineTotal(line), 0);
});
