import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPerUnitSuffix,
  formatProductDefaultPrice,
  getProductBaseUnitAbbreviation,
  getProductBaseUnitName,
  getSnapshotAbbreviation,
} from "./product-uom";

// ---------------------------------------------------------------------------
// getProductBaseUnitAbbreviation
// ---------------------------------------------------------------------------

test("getProductBaseUnitAbbreviation: returns abbreviation when present", () => {
  assert.equal(
    getProductBaseUnitAbbreviation({ baseUnit: { abbreviation: "ea" } }),
    "ea",
  );
  assert.equal(
    getProductBaseUnitAbbreviation({ baseUnit: { abbreviation: "gal" } }),
    "gal",
  );
});

test("getProductBaseUnitAbbreviation: falls back to 'unit' for null/missing base unit", () => {
  // Historical products without an explicit baseUnit should still render
  // a sensible suffix so the UI doesn't show a bare "/" or empty string —
  // but a non-meat vertical shouldn't see "lb" rendered for missing data.
  assert.equal(getProductBaseUnitAbbreviation(null), "unit");
  assert.equal(getProductBaseUnitAbbreviation(undefined), "unit");
  assert.equal(getProductBaseUnitAbbreviation({ baseUnit: null }), "unit");
  assert.equal(
    getProductBaseUnitAbbreviation({ baseUnit: { abbreviation: null } }),
    "unit",
  );
});

// ---------------------------------------------------------------------------
// getProductBaseUnitName
// ---------------------------------------------------------------------------

test("getProductBaseUnitName: prefers full name, then abbreviation, then 'unit'", () => {
  assert.equal(
    getProductBaseUnitName({
      baseUnit: { name: "Gallon", abbreviation: "gal" },
    }),
    "Gallon",
  );
  assert.equal(
    getProductBaseUnitName({ baseUnit: { name: null, abbreviation: "gal" } }),
    "gal",
  );
  assert.equal(getProductBaseUnitName(null), "unit");
});

// ---------------------------------------------------------------------------
// formatPerUnitSuffix
// ---------------------------------------------------------------------------

test("formatPerUnitSuffix: prepends a single slash to the abbreviation", () => {
  assert.equal(
    formatPerUnitSuffix({ baseUnit: { abbreviation: "lb" } }),
    "/lb",
  );
  assert.equal(
    formatPerUnitSuffix({ baseUnit: { abbreviation: "case" } }),
    "/case",
  );
  // Fallback path produces "/unit" — explicit "no base unit was set" rather
  // than the misleading "/lb".
  assert.equal(formatPerUnitSuffix(null), "/unit");
});

// ---------------------------------------------------------------------------
// getSnapshotAbbreviation
// ---------------------------------------------------------------------------

test("getSnapshotAbbreviation: snapshot wins when present", () => {
  // Even when the product's base unit changes later, snapshot wins so
  // history doesn't get rewritten.
  assert.equal(
    getSnapshotAbbreviation("gal", { baseUnit: { abbreviation: "lb" } }),
    "gal",
  );
});

test("getSnapshotAbbreviation: falls back to product base when snapshot empty", () => {
  assert.equal(
    getSnapshotAbbreviation(null, { baseUnit: { abbreviation: "ea" } }),
    "ea",
  );
  assert.equal(
    getSnapshotAbbreviation("", { baseUnit: { abbreviation: "ea" } }),
    "ea",
  );
  assert.equal(
    getSnapshotAbbreviation("   ", { baseUnit: { abbreviation: "ea" } }),
    "ea",
  );
});

test("getSnapshotAbbreviation: ultimate fallback is 'unit'", () => {
  assert.equal(getSnapshotAbbreviation(null, null), "unit");
});

// ---------------------------------------------------------------------------
// formatProductDefaultPrice
// ---------------------------------------------------------------------------

test("formatProductDefaultPrice: renders dash for null / empty / zero", () => {
  // The product form coerces empty input to "0" before insert and the
  // column is NOT NULL, so "0" is the canonical "not set" sentinel — not
  // an actual price of zero. Listing and detail surfaces must agree.
  assert.equal(formatProductDefaultPrice(null), "—");
  assert.equal(formatProductDefaultPrice(undefined), "—");
  assert.equal(formatProductDefaultPrice(""), "—");
  assert.equal(formatProductDefaultPrice("0"), "—");
  assert.equal(formatProductDefaultPrice("0.00"), "—");
  assert.equal(formatProductDefaultPrice(0), "—");
});

test("formatProductDefaultPrice: formats positive values as USD", () => {
  assert.equal(formatProductDefaultPrice("8.99"), "$8.99");
  assert.equal(formatProductDefaultPrice("12"), "$12.00");
  assert.equal(formatProductDefaultPrice(1.5), "$1.50");
});

test("formatProductDefaultPrice: honors custom placeholder", () => {
  assert.equal(
    formatProductDefaultPrice("0", { placeholder: "Not set" }),
    "Not set",
  );
});
