import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getDefaultPurchaseUnit,
  inferLineUnitTypeFromAbbreviation,
  type ProductWithUnits,
} from "./product-purchase-defaults";

// ---------------------------------------------------------------------------
// inferLineUnitTypeFromAbbreviation — abbreviation → unit type mapping
// ---------------------------------------------------------------------------

test("inferLineUnitTypeFromAbbreviation: lb → catch_weight", () => {
  assert.equal(inferLineUnitTypeFromAbbreviation("lb"), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation("LB"), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation("lbs"), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation("kg"), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation("oz"), "catch_weight");
});

test("inferLineUnitTypeFromAbbreviation: ea/each/pc → per_each", () => {
  assert.equal(inferLineUnitTypeFromAbbreviation("ea"), "per_each");
  assert.equal(inferLineUnitTypeFromAbbreviation("EACH"), "per_each");
  assert.equal(inferLineUnitTypeFromAbbreviation("pc"), "per_each");
  assert.equal(inferLineUnitTypeFromAbbreviation("pcs"), "per_each");
});

test("inferLineUnitTypeFromAbbreviation: cs/gal/bag → per_unit", () => {
  assert.equal(inferLineUnitTypeFromAbbreviation("cs"), "per_unit");
  assert.equal(inferLineUnitTypeFromAbbreviation("case"), "per_unit");
  assert.equal(inferLineUnitTypeFromAbbreviation("gal"), "per_unit");
  assert.equal(inferLineUnitTypeFromAbbreviation("bag"), "per_unit");
  assert.equal(inferLineUnitTypeFromAbbreviation("pk"), "per_unit");
});

test("inferLineUnitTypeFromAbbreviation: empty/null falls back to catch_weight", () => {
  assert.equal(inferLineUnitTypeFromAbbreviation(""), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation(null), "catch_weight");
  assert.equal(inferLineUnitTypeFromAbbreviation(undefined), "catch_weight");
});

// ---------------------------------------------------------------------------
// getDefaultPurchaseUnit — resolver priority
// ---------------------------------------------------------------------------

function uom(id: string, abbreviation: string): { id: string; abbreviation: string } {
  return { id, abbreviation };
}

test("getDefaultPurchaseUnit: explicit purchase row with isDefault wins", () => {
  const product: ProductWithUnits = {
    baseUnit: uom("u-lb", "lb"),
    productUnits: [
      {
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1",
        unit: uom("u-lb", "lb"),
        sortOrder: 0,
      },
      {
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "12",
        unit: uom("u-case", "case"),
        sortOrder: 0,
      },
    ],
  };
  const result = getDefaultPurchaseUnit(product);
  assert.ok(result);
  assert.equal(result.unitType, "per_unit");
  assert.equal(result.abbreviation, "case");
  assert.equal(result.unitId, "u-case");
  assert.equal(result.conversionToBase, 12);
});

test("getDefaultPurchaseUnit: any purchase row when none is flagged default", () => {
  const product: ProductWithUnits = {
    baseUnit: uom("u-ea", "ea"),
    productUnits: [
      {
        purpose: "purchase",
        isDefault: false,
        conversionToBase: "1",
        unit: uom("u-ea", "ea"),
        sortOrder: 1,
      },
    ],
  };
  const result = getDefaultPurchaseUnit(product);
  assert.ok(result);
  assert.equal(result.unitType, "per_each");
  assert.equal(result.abbreviation, "ea");
  assert.equal(result.unitId, "u-ea");
});

test("getDefaultPurchaseUnit: lowest sortOrder wins among multiple purchase rows", () => {
  const product: ProductWithUnits = {
    baseUnit: uom("u-ea", "ea"),
    productUnits: [
      {
        purpose: "purchase",
        isDefault: false,
        conversionToBase: "24",
        unit: uom("u-bag", "bag"),
        sortOrder: 2,
      },
      {
        purpose: "purchase",
        isDefault: false,
        conversionToBase: "12",
        unit: uom("u-case", "case"),
        sortOrder: 0,
      },
    ],
  };
  const result = getDefaultPurchaseUnit(product);
  assert.ok(result);
  assert.equal(result.abbreviation, "case");
});

test("getDefaultPurchaseUnit: falls back to baseUnit when no purchase rows exist", () => {
  const product: ProductWithUnits = {
    baseUnit: uom("u-lb", "lb"),
    productUnits: [
      {
        // sales-only product — typical state today
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1",
        unit: uom("u-lb", "lb"),
        sortOrder: 0,
      },
    ],
  };
  const result = getDefaultPurchaseUnit(product);
  assert.ok(result);
  assert.equal(result.unitType, "catch_weight");
  assert.equal(result.abbreviation, "lb");
  assert.equal(result.unitId, "u-lb");
  assert.equal(result.conversionToBase, 1);
});

test("getDefaultPurchaseUnit: baseUnit-only product (no productUnits)", () => {
  const product: ProductWithUnits = {
    baseUnit: uom("u-ea", "ea"),
    productUnits: [],
  };
  const result = getDefaultPurchaseUnit(product);
  assert.ok(result);
  assert.equal(result.unitType, "per_each");
  assert.equal(result.abbreviation, "ea");
});

test("getDefaultPurchaseUnit: null product returns null", () => {
  assert.equal(getDefaultPurchaseUnit(null), null);
  assert.equal(getDefaultPurchaseUnit(undefined), null);
});

test("getDefaultPurchaseUnit: product with neither baseUnit nor purchase rows → null", () => {
  const product: ProductWithUnits = {
    baseUnit: null,
    productUnits: [
      {
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1",
        unit: { id: "u-ea", abbreviation: "ea" },
        sortOrder: 0,
      },
    ],
  };
  assert.equal(getDefaultPurchaseUnit(product), null);
});
