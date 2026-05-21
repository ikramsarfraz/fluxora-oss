import assert from "node:assert/strict";
import { test } from "node:test";

import { convertAiLineToPrefill, type AiLineLike } from "./ai-line-conversion";

function makeAiLine(overrides: Partial<AiLineLike> = {}): AiLineLike {
  return {
    vendorProductName: "CHICKEN TENDERS",
    quantityCases: 4,
    quantityWeight: 160,
    caseWeights: null,
    unitPrice: 2.5,
    lineTotal: 400,
    unitType: "catch_weight",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Total-weight passthrough
// ---------------------------------------------------------------------------

test("convertAiLineToPrefill: passes through total weight without flags", () => {
  const { line, backCalculatedWeight, manualCaseWeights } = convertAiLineToPrefill(
    makeAiLine(),
  );

  assert.equal(line.weightEntryMode, "total_weight");
  assert.equal(line.quantityCases, "4");
  assert.equal(line.weightLbs, "160");
  assert.equal(line.unitPrice, "2.5");
  assert.equal(line.unitType, "catch_weight");
  assert.equal(backCalculatedWeight, false);
  assert.equal(manualCaseWeights, false);
});

// ---------------------------------------------------------------------------
// Weight back-calculation
// ---------------------------------------------------------------------------

test("convertAiLineToPrefill: back-calculates weight when null and totals are present", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({ quantityWeight: null, lineTotal: 160, unitPrice: 2 }),
  );

  assert.equal(result.line.weightLbs, "80");
  assert.equal(result.backCalculatedWeight, true);
});

test("convertAiLineToPrefill: back-calculates weight when 0 (model returned 0 instead of null)", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({ quantityWeight: 0, lineTotal: 75, unitPrice: 1.5 }),
  );

  assert.equal(result.line.weightLbs, "50");
  assert.equal(result.backCalculatedWeight, true);
});

test("convertAiLineToPrefill: does not back-calc when unitPrice is null", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({ quantityWeight: null, unitPrice: null }),
  );

  assert.equal(result.line.weightLbs, "0");
  assert.equal(result.backCalculatedWeight, false);
});

test("convertAiLineToPrefill: does not back-calc for fixed_case lines", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({
      unitType: "fixed_case",
      quantityWeight: null,
      lineTotal: 100,
      unitPrice: 25,
      quantityCases: 4,
    }),
  );

  assert.equal(result.line.weightLbs, "0");
  assert.equal(result.backCalculatedWeight, false);
});

// ---------------------------------------------------------------------------
// Per-case weights → manual_case_weights mode
// ---------------------------------------------------------------------------

test("convertAiLineToPrefill: populates manual case weights when count matches", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({
      quantityCases: 5,
      caseWeights: [22.5, 23.1, 22.8, 24, 23.4],
      quantityWeight: null,
    }),
  );

  assert.equal(result.manualCaseWeights, true);
  assert.equal(result.line.weightEntryMode, "manual_case_weights");
  assert.deepEqual(result.line.caseWeightEntries, ["22.5", "23.1", "22.8", "24", "23.4"]);
  // weightLbs should equal the per-case sum
  assert.equal(Number(result.line.weightLbs), 115.8);
});

test("convertAiLineToPrefill: derives quantityCases from caseWeights when missing", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({
      quantityCases: null,
      caseWeights: [22.5, 23.1, 22.8],
      quantityWeight: null,
      lineTotal: null,
      unitPrice: null,
    }),
  );

  assert.equal(result.line.quantityCases, "3");
  assert.equal(result.line.weightEntryMode, "manual_case_weights");
  assert.equal(result.manualCaseWeights, true);
  assert.deepEqual(result.line.caseWeightEntries, ["22.5", "23.1", "22.8"]);
});

test("convertAiLineToPrefill: falls back to total_weight when caseWeights count disagrees", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({
      quantityCases: 5,
      caseWeights: [22.5, 23.1],
      quantityWeight: 115,
    }),
  );

  assert.equal(result.manualCaseWeights, false);
  assert.equal(result.line.weightEntryMode, "total_weight");
  assert.equal(result.line.weightLbs, "115");
});

test("convertAiLineToPrefill: ignores empty caseWeights array", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({ caseWeights: [], quantityWeight: 100 }),
  );

  assert.equal(result.manualCaseWeights, false);
  assert.equal(result.line.weightEntryMode, "total_weight");
});

test("convertAiLineToPrefill: caseWeightEntries length equals quantityCases when in total mode", () => {
  const result = convertAiLineToPrefill(makeAiLine({ quantityCases: 6 }));

  // Empty placeholders so the form editor can grow into manual mode if needed.
  assert.equal(result.line.caseWeightEntries.length, 6);
  assert.ok(result.line.caseWeightEntries.every(v => v === ""));
});

test("convertAiLineToPrefill: handles null unitType by defaulting to catch_weight", () => {
  const result = convertAiLineToPrefill(makeAiLine({ unitType: null }));
  assert.equal(result.line.unitType, "catch_weight");
});

test("convertAiLineToPrefill: invalid quantityCases (decimal or negative) defaults to 1", () => {
  const result = convertAiLineToPrefill(
    makeAiLine({ quantityCases: -3, caseWeights: null }),
  );
  assert.equal(result.line.quantityCases, "1");
});

// ---------------------------------------------------------------------------
// Per-each / per-unit modes — non-weight pricing for beverages etc.
// ---------------------------------------------------------------------------

test("convertAiLineToPrefill: per_each skips weight back-calc and carries quantity verbatim", () => {
  const { line, backCalculatedWeight, manualCaseWeights } = convertAiLineToPrefill({
    vendorProductName: "COCA-COLA 12OZ CAN",
    quantityCases: 24,
    quantityWeight: null,
    caseWeights: null,
    unitPrice: 1.25,
    lineTotal: 30,
    unitType: "per_each",
    unitOfMeasure: "ea",
  });
  assert.equal(line.unitType, "per_each");
  assert.equal(line.quantityCases, "24");
  assert.equal(line.weightLbs, "0");
  assert.equal(line.unitPrice, "1.25");
  assert.equal(line.purchaseUnitAbbreviation, "ea");
  assert.equal(line.weightEntryMode, "total_weight");
  assert.equal(backCalculatedWeight, false);
  assert.equal(manualCaseWeights, false);
});

test("convertAiLineToPrefill: per_unit passes through the abbreviation and skips weight", () => {
  const { line, backCalculatedWeight } = convertAiLineToPrefill({
    vendorProductName: "COCA-COLA 12PK CASE",
    quantityCases: 5,
    quantityWeight: 50, // model returned weight; we should ignore it
    caseWeights: null,
    unitPrice: 9.99,
    lineTotal: 49.95,
    unitType: "per_unit",
    unitOfMeasure: "case",
  });
  assert.equal(line.unitType, "per_unit");
  assert.equal(line.quantityCases, "5");
  // per_unit ignores weight entirely — no back-calc, no carry-through
  assert.equal(line.weightLbs, "0");
  assert.equal(line.unitPrice, "9.99");
  assert.equal(line.purchaseUnitAbbreviation, "case");
  assert.equal(backCalculatedWeight, false);
});

test("convertAiLineToPrefill: per_each without abbreviation falls back to empty string", () => {
  const { line } = convertAiLineToPrefill({
    vendorProductName: "WATER BOTTLE",
    quantityCases: 12,
    quantityWeight: null,
    caseWeights: null,
    unitPrice: 0.5,
    lineTotal: 6,
    unitType: "per_each",
    unitOfMeasure: null,
  });
  assert.equal(line.purchaseUnitAbbreviation, "");
});

test("convertAiLineToPrefill: catch_weight still carries unitOfMeasure as empty string", () => {
  // Weight modes don't use the abbreviation, but the form field is still
  // populated to keep the prefill shape stable.
  const { line } = convertAiLineToPrefill(makeAiLine({ unitOfMeasure: null }));
  assert.equal(line.purchaseUnitAbbreviation, "");
});
