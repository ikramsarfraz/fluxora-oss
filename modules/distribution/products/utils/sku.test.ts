import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSkuBase,
  categoryNameToSkuPrefix,
  generateSku,
  nextSkuForBase,
  slugFromName,
} from "./sku";

// ---------------------------------------------------------------------------
// categoryNameToSkuPrefix
// ---------------------------------------------------------------------------

test("categoryNameToSkuPrefix: maps known meat verticals", () => {
  assert.equal(categoryNameToSkuPrefix("Chicken"), "CHK");
  assert.equal(categoryNameToSkuPrefix("Beef"), "BEF");
  assert.equal(categoryNameToSkuPrefix("Pork"), "PRK");
  assert.equal(categoryNameToSkuPrefix("Lamb"), "LAM");
  assert.equal(categoryNameToSkuPrefix("Seafood"), "SEA");
  assert.equal(categoryNameToSkuPrefix("Fish"), "SEA");
});

test("categoryNameToSkuPrefix: case-insensitive on the leading word", () => {
  assert.equal(categoryNameToSkuPrefix("CHICKEN"), "CHK");
  assert.equal(categoryNameToSkuPrefix("beef ribeye"), "BEF");
  assert.equal(categoryNameToSkuPrefix("PoRk"), "PRK");
});

test("categoryNameToSkuPrefix: only matches at the START of the category", () => {
  // "Halal Beef" doesn't start with "beef" — should fall back to OTH so a
  // beef-suffixed category in another vertical doesn't get the BEF prefix.
  assert.equal(categoryNameToSkuPrefix("Halal Beef"), "OTH");
  assert.equal(categoryNameToSkuPrefix("Frozen Chicken"), "OTH");
});

test("categoryNameToSkuPrefix: falls back to OTH for unknown / missing", () => {
  assert.equal(categoryNameToSkuPrefix("Beverages"), "OTH");
  assert.equal(categoryNameToSkuPrefix("Dry Goods"), "OTH");
  assert.equal(categoryNameToSkuPrefix(""), "OTH");
  assert.equal(categoryNameToSkuPrefix(null), "OTH");
  assert.equal(categoryNameToSkuPrefix(undefined), "OTH");
});

// ---------------------------------------------------------------------------
// slugFromName
// ---------------------------------------------------------------------------

test("slugFromName: first word, uppercased, capped at 4 chars", () => {
  assert.equal(slugFromName("Ribeye"), "RIBE");
  assert.equal(slugFromName("Ground"), "GROU");
  assert.equal(slugFromName("Tenderloin Filet"), "TEND");
});

test("slugFromName: strips non-alphanumeric characters", () => {
  assert.equal(slugFromName("Ribeye!"), "RIBE");
  // Apostrophes and punctuation drop out entirely, then the first word is taken.
  assert.equal(slugFromName("Mom's Recipe"), "MOMS");
  assert.equal(slugFromName("Three-Bean Salad"), "THRE");
});

test("slugFromName: ITEM fallback for empty / whitespace / punctuation-only", () => {
  assert.equal(slugFromName(""), "ITEM");
  assert.equal(slugFromName("   "), "ITEM");
  assert.equal(slugFromName("!!!"), "ITEM");
  // null / undefined coerced via the `?? ""` guard.
  assert.equal(slugFromName(null as unknown as string), "ITEM");
});

test("slugFromName: short first words pass through whole", () => {
  assert.equal(slugFromName("Eggs"), "EGGS");
  assert.equal(slugFromName("Tea Bag"), "TEA");
});

// ---------------------------------------------------------------------------
// buildSkuBase
// ---------------------------------------------------------------------------

test("buildSkuBase: combines prefix + slug", () => {
  assert.equal(buildSkuBase("Ribeye", "Beef"), "BEF-RIBE");
  assert.equal(buildSkuBase("Whole Chicken", "Chicken"), "CHK-WHOL");
});

test("buildSkuBase: OTH fallback when category is unknown / missing", () => {
  assert.equal(buildSkuBase("Bottled Water", "Beverages"), "OTH-BOTT");
  assert.equal(buildSkuBase("Ribeye", null), "OTH-RIBE");
  assert.equal(buildSkuBase("Ribeye", ""), "OTH-RIBE");
});

test("buildSkuBase: ITEM fallback when name is empty", () => {
  assert.equal(buildSkuBase("", "Beef"), "BEF-ITEM");
});

// ---------------------------------------------------------------------------
// nextSkuForBase
// ---------------------------------------------------------------------------

test("nextSkuForBase: starts at -01 when no SKUs share the base", () => {
  assert.equal(nextSkuForBase("BEF-RIBE", []), "BEF-RIBE-01");
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["CHK-WHOL-01", "PRK-SHOU-03"]),
    "BEF-RIBE-01",
  );
});

test("nextSkuForBase: increments past the highest matching suffix", () => {
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["BEF-RIBE-01", "BEF-RIBE-02"]),
    "BEF-RIBE-03",
  );
  // Gaps in the sequence don't pull the next pick down — always max+1.
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["BEF-RIBE-01", "BEF-RIBE-05"]),
    "BEF-RIBE-06",
  );
});

test("nextSkuForBase: rolls past 99 to 3-digit suffixes without padding", () => {
  // Padding is only applied to width-2 (e.g. "01"); width-3+ pass through.
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["BEF-RIBE-99"]),
    "BEF-RIBE-100",
  );
});

test("nextSkuForBase: case-insensitive prefix match", () => {
  assert.equal(
    nextSkuForBase("bef-ribe", ["BEF-RIBE-01", "BEF-RIBE-02"]),
    "bef-ribe-03",
  );
});

test("nextSkuForBase: ignores SKUs that match the base but lack a -NN suffix", () => {
  // Hand-edited SKUs without the numeric tail don't claim a slot.
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["BEF-RIBE", "BEF-RIBE-CUSTOM"]),
    "BEF-RIBE-01",
  );
});

test("nextSkuForBase: ignores SKUs whose base doesn't share the prefix", () => {
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["CHK-WHOL-01", "PRK-SHOU-03"]),
    "BEF-RIBE-01",
  );
});

test("nextSkuForBase: known overlap with longer-name slugs (documented)", () => {
  // "BEF-RIBEYE-01" startsWith("BEF-RIBE") is true, so the longer-named
  // row's suffix counts toward the base sequence. Two products that
  // share the first 4 characters of their first word will collide here;
  // the service's unique-index retry in createProduct catches it.
  // Documenting the behaviour rather than silently changing it.
  assert.equal(
    nextSkuForBase("BEF-RIBE", ["BEF-RIBEYE-01"]),
    "BEF-RIBE-02",
  );
});

// ---------------------------------------------------------------------------
// generateSku (integration of the three helpers above)
// ---------------------------------------------------------------------------

test("generateSku: empty catalog produces BASE-01", () => {
  assert.equal(generateSku("Ribeye", "Beef", []), "BEF-RIBE-01");
  assert.equal(generateSku("Ribeye", "Beef", undefined), "BEF-RIBE-01");
});

test("generateSku: increments past matching catalog rows", () => {
  assert.equal(
    generateSku("Ribeye", "Beef", [
      { sku: "BEF-RIBE-01" },
      { sku: "BEF-RIBE-02" },
      { sku: "CHK-WHOL-01" }, // different base — ignored
    ]),
    "BEF-RIBE-03",
  );
});

test("generateSku: non-meat tenant gets a stable OTH-prefixed SKU", () => {
  assert.equal(
    generateSku("Bottled Water", "Beverages", []),
    "OTH-BOTT-01",
  );
});
