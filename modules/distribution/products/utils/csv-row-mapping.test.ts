import assert from "node:assert/strict";
import { test } from "node:test";

import {
  csvRowToProductInput,
  findCategoryIdByName,
  findUnitIdByAbbreviation,
} from "./csv-row-mapping";

// ---------------------------------------------------------------------------
// csvRowToProductInput
// ---------------------------------------------------------------------------

test("csvRowToProductInput: trims sku and name", () => {
  const input = csvRowToProductInput({
    sku: "  BEF-RIBE-01  ",
    name: "  Beef Ribeye  ",
  });
  assert.equal(input.sku, "BEF-RIBE-01");
  assert.equal(input.name, "Beef Ribeye");
});

test("csvRowToProductInput: defaultPricePerLb passes through unchanged when present", () => {
  // Numeric validity is the modal's responsibility; the mapper is pure
  // and just forwards whatever the user typed.
  assert.equal(
    csvRowToProductInput({ sku: "X", name: "Y", default_price: "8.99" })
      .defaultPricePerLb,
    "8.99",
  );
});

test("csvRowToProductInput: empty default_price falls through to undefined", () => {
  // Service-side default kicks in ("0"). Returning undefined lets the
  // service know the user didn't supply a value (vs. an explicit zero).
  assert.equal(
    csvRowToProductInput({ sku: "X", name: "Y", default_price: "" })
      .defaultPricePerLb,
    undefined,
  );
  assert.equal(
    csvRowToProductInput({ sku: "X", name: "Y" }).defaultPricePerLb,
    undefined,
  );
});

test("csvRowToProductInput: resolved ids forward through, default to null", () => {
  // The page layer resolves category/unit names → uuids and passes them
  // in. Unresolved (not found) values become explicit null.
  const resolved = csvRowToProductInput(
    { sku: "X", name: "Y" },
    {
      categoryId: "cat-uuid",
      baseUnitId: "unit-uuid",
    },
  );
  assert.equal(resolved.categoryId, "cat-uuid");
  assert.equal(resolved.baseUnitId, "unit-uuid");

  const unresolved = csvRowToProductInput({ sku: "X", name: "Y" });
  assert.equal(unresolved.categoryId, null);
  assert.equal(unresolved.baseUnitId, null);
});

// ---------------------------------------------------------------------------
// findCategoryIdByName
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "cat-beef", name: "Beef" },
  { id: "cat-chicken", name: "Chicken" },
];

test("findCategoryIdByName: case-insensitive match returns id", () => {
  assert.equal(findCategoryIdByName("Beef", CATEGORIES), "cat-beef");
  assert.equal(findCategoryIdByName("BEEF", CATEGORIES), "cat-beef");
  assert.equal(findCategoryIdByName("beef", CATEGORIES), "cat-beef");
});

test("findCategoryIdByName: trims surrounding whitespace", () => {
  assert.equal(findCategoryIdByName("  Beef  ", CATEGORIES), "cat-beef");
});

test("findCategoryIdByName: returns null for missing / empty / no match", () => {
  assert.equal(findCategoryIdByName("", CATEGORIES), null);
  assert.equal(findCategoryIdByName("   ", CATEGORIES), null);
  assert.equal(findCategoryIdByName(undefined, CATEGORIES), null);
  assert.equal(findCategoryIdByName("Beverages", CATEGORIES), null);
});

// ---------------------------------------------------------------------------
// findUnitIdByAbbreviation
// ---------------------------------------------------------------------------

const UNITS = [
  { id: "u-lb", abbreviation: "lb", name: "Pound", isActive: true },
  { id: "u-ea", abbreviation: "ea", name: "Each", isActive: true },
  { id: "u-gal", abbreviation: "gal", name: "Gallon", isActive: true },
  // Inactive unit — must not be returned even on exact match.
  { id: "u-old", abbreviation: "old", name: "Old Unit", isActive: false },
];

test("findUnitIdByAbbreviation: matches by abbreviation first", () => {
  assert.equal(findUnitIdByAbbreviation("lb", UNITS), "u-lb");
  assert.equal(findUnitIdByAbbreviation("LB", UNITS), "u-lb");
  assert.equal(findUnitIdByAbbreviation("ea", UNITS), "u-ea");
});

test("findUnitIdByAbbreviation: falls back to name when abbreviation misses", () => {
  // "Gallon" doesn't match any abbreviation but does match a unit name.
  assert.equal(findUnitIdByAbbreviation("Gallon", UNITS), "u-gal");
  assert.equal(findUnitIdByAbbreviation("pound", UNITS), "u-lb");
});

test("findUnitIdByAbbreviation: ignores inactive units", () => {
  // The "old" unit is inactive, so a CSV that references it must
  // surface as unresolved — otherwise we'd silently route stock onto
  // a deprecated unit.
  assert.equal(findUnitIdByAbbreviation("old", UNITS), null);
  assert.equal(findUnitIdByAbbreviation("Old Unit", UNITS), null);
});

test("findUnitIdByAbbreviation: returns null for empty / missing / no match", () => {
  assert.equal(findUnitIdByAbbreviation("", UNITS), null);
  assert.equal(findUnitIdByAbbreviation("   ", UNITS), null);
  assert.equal(findUnitIdByAbbreviation(undefined, UNITS), null);
  assert.equal(findUnitIdByAbbreviation("furlong", UNITS), null);
});
