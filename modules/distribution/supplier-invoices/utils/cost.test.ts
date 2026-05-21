import assert from "node:assert/strict";
import { test } from "node:test";

import {
  supplierInvoiceLineCostPerLb,
  supplierInvoiceLineCostPerUnit,
} from "./cost";

// ---------------------------------------------------------------------------
// supplierInvoiceLineCostPerLb — weight modes
// ---------------------------------------------------------------------------

test("supplierInvoiceLineCostPerLb: catch_weight returns the unit price verbatim", () => {
  const cost = supplierInvoiceLineCostPerLb({
    quantityCases: 4,
    weightLbs: "160",
    unitType: "catch_weight",
    unitPrice: "2.5000",
  });
  assert.equal(cost, "2.5000");
});

test("supplierInvoiceLineCostPerLb: fixed_case divides total by weight", () => {
  const cost = supplierInvoiceLineCostPerLb({
    quantityCases: 10,
    weightLbs: "200",
    unitType: "fixed_case",
    unitPrice: "20",
  });
  // 10 * $20 / 200 lb = $1.00 / lb
  assert.equal(cost, "1.0000");
});

test("supplierInvoiceLineCostPerLb: fixed_case with zero weight returns null", () => {
  const cost = supplierInvoiceLineCostPerLb({
    quantityCases: 10,
    weightLbs: "0",
    unitType: "fixed_case",
    unitPrice: "20",
  });
  assert.equal(cost, null);
});

// ---------------------------------------------------------------------------
// supplierInvoiceLineCostPerLb — unit-priced modes are not weight-comparable
// ---------------------------------------------------------------------------

test("supplierInvoiceLineCostPerLb: per_each returns null (no comparable $/lb)", () => {
  const cost = supplierInvoiceLineCostPerLb({
    quantityCases: 24,
    weightLbs: "0",
    unitType: "per_each",
    unitPrice: "1.25",
  });
  assert.equal(cost, null);
});

test("supplierInvoiceLineCostPerLb: per_unit returns null", () => {
  const cost = supplierInvoiceLineCostPerLb({
    quantityCases: 5,
    weightLbs: "0",
    unitType: "per_unit",
    unitPrice: "9.99",
  });
  assert.equal(cost, null);
});

// ---------------------------------------------------------------------------
// supplierInvoiceLineCostPerUnit — only meaningful for non-weight modes
// ---------------------------------------------------------------------------

test("supplierInvoiceLineCostPerUnit: per_each returns the unit price as both per-unit and per-base", () => {
  const result = supplierInvoiceLineCostPerUnit({
    unitType: "per_each",
    unitPrice: "1.25",
  });
  assert.deepEqual(result, { perUnit: "1.2500", perBase: "1.2500" });
});

test("supplierInvoiceLineCostPerUnit: per_unit with case-of-12 normalizes to per-each", () => {
  const result = supplierInvoiceLineCostPerUnit({
    unitType: "per_unit",
    unitPrice: "9.99",
    conversionToBase: 12,
  });
  assert.ok(result, "expected a result for per_unit");
  assert.equal(result.perUnit, "9.9900");
  // 9.99 / 12 = 0.8325
  assert.equal(result.perBase, "0.8325");
});

test("supplierInvoiceLineCostPerUnit: per_unit without conversion leaves perBase null", () => {
  const result = supplierInvoiceLineCostPerUnit({
    unitType: "per_unit",
    unitPrice: "9.99",
  });
  assert.deepEqual(result, { perUnit: "9.9900", perBase: null });
});

test("supplierInvoiceLineCostPerUnit: catch_weight returns null", () => {
  const result = supplierInvoiceLineCostPerUnit({
    unitType: "catch_weight",
    unitPrice: "2.50",
  });
  assert.equal(result, null);
});
