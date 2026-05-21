import assert from "node:assert/strict";
import { test } from "node:test";

import { formatInventoryQuantity, formatWeightLbs } from "./insights";

// ---------------------------------------------------------------------------
// formatInventoryQuantity — family-aware quantity for the inventory grid
// ---------------------------------------------------------------------------

test("formatInventoryQuantity: catch_weight uses weight + base abbreviation", () => {
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: "catch_weight",
    exactWeightLbs: "12.5",
    cases: 1,
    baseUnitAbbreviation: "lb",
  });
  assert.equal(out, "12.50 lb");
});

test("formatInventoryQuantity: catch_weight with kg base", () => {
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: "catch_weight",
    exactWeightLbs: "5.6789",
    cases: 1,
    baseUnitAbbreviation: "kg",
  });
  assert.equal(out, "5.68 kg");
});

test("formatInventoryQuantity: fixed_case also uses weight + abbreviation", () => {
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: "fixed_case",
    exactWeightLbs: "40",
    cases: 1,
    baseUnitAbbreviation: "lb",
  });
  assert.equal(out, "40.00 lb");
});

test("formatInventoryQuantity: per_each uses cases + base abbreviation", () => {
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: "per_each",
    exactWeightLbs: "0",
    cases: 1,
    baseUnitAbbreviation: "ea",
  });
  assert.equal(out, "1 ea");
});

test("formatInventoryQuantity: per_unit (e.g. case-of-12) shows count in base UOM", () => {
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: "per_unit",
    exactWeightLbs: "0",
    cases: 1,
    baseUnitAbbreviation: "case",
  });
  assert.equal(out, "1 case");
});

test("formatInventoryQuantity: null snapshot defaults to weight mode (legacy rows)", () => {
  // Pre-V1 inventory rows don't carry a cost_unit_type_snapshot — assume
  // weight so the historical display ("X.XX lb") keeps working.
  const out = formatInventoryQuantity({
    costUnitTypeSnapshot: null,
    exactWeightLbs: "8",
    cases: 1,
    baseUnitAbbreviation: null,
  });
  assert.equal(out, "8.00 lb");
});

test("formatInventoryQuantity: missing base abbreviation falls back to lb/ea", () => {
  const weight = formatInventoryQuantity({
    costUnitTypeSnapshot: "catch_weight",
    exactWeightLbs: "3",
    cases: 1,
    baseUnitAbbreviation: null,
  });
  assert.equal(weight, "3.00 lb");

  const count = formatInventoryQuantity({
    costUnitTypeSnapshot: "per_each",
    exactWeightLbs: "0",
    cases: 5,
    baseUnitAbbreviation: null,
  });
  assert.equal(count, "5 ea");
});

// ---------------------------------------------------------------------------
// formatWeightLbs sanity (existing helper, still in use)
// ---------------------------------------------------------------------------

test("formatWeightLbs: 2 decimals", () => {
  assert.equal(formatWeightLbs("12.5"), "12.50");
  assert.equal(formatWeightLbs(0), "0.00");
  assert.equal(formatWeightLbs(null), "0.00");
});
