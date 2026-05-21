import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPerUnitSuffix,
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

test("getProductBaseUnitAbbreviation: falls back to lb for null/missing base unit", () => {
  // Historical products without an explicit baseUnit should still render
  // a sensible suffix so the UI doesn't show a bare "/" or empty string.
  assert.equal(getProductBaseUnitAbbreviation(null), "lb");
  assert.equal(getProductBaseUnitAbbreviation(undefined), "lb");
  assert.equal(
    getProductBaseUnitAbbreviation({ baseUnit: null }),
    "lb",
  );
  assert.equal(
    getProductBaseUnitAbbreviation({ baseUnit: { abbreviation: null } }),
    "lb",
  );
});

// ---------------------------------------------------------------------------
// getProductBaseUnitName
// ---------------------------------------------------------------------------

test("getProductBaseUnitName: prefers full name, then abbreviation, then lb", () => {
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
  assert.equal(getProductBaseUnitName(null), "lb");
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
  // Fallback path still produces "/lb".
  assert.equal(formatPerUnitSuffix(null), "/lb");
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

test("getSnapshotAbbreviation: ultimate fallback is lb", () => {
  assert.equal(getSnapshotAbbreviation(null, null), "lb");
});
