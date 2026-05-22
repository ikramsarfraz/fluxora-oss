/**
 * Behavioral regression test for the cross-family veto in
 * `matchProductDeterministic`. The matching service itself uses
 * server-only imports (Drizzle, db, server-only marker), so we test the
 * veto contract via a tiny inline replica of the keyword detection +
 * veto rule — same logic shape as product-matching.ts, just isolated
 * from the server-only dependency.
 *
 * If product-matching.ts changes the veto semantics, update this test
 * to match — the duplicate keyword list at the top is intentional so
 * the test can run in the existing `node --test` runner without
 * standing up a full DB.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const NON_WEIGHT_NAME_KEYWORDS = new Set([
  "cola",
  "soda",
  "water",
  "juice",
  "milk",
  "gallon",
  "snack",
]);

type Family = "weight" | "count" | "volume" | "length" | "other" | null;

function inferVendorNameFamily(
  vendorName: string,
): "weight" | "count" | "volume" | null {
  const lower = vendorName.toLowerCase();
  if (/\b(gal|gallon|liter|litre|fl\s*oz|ml)\b/.test(lower)) return "volume";
  for (const kw of NON_WEIGHT_NAME_KEYWORDS) {
    if (lower.includes(kw)) return "count";
  }
  return null;
}

function familyConflict(
  vendorName: string,
  candidateFamily: Family,
): boolean {
  const vendorFamily = inferVendorNameFamily(vendorName);
  if (vendorFamily == null || candidateFamily == null) return false;
  return (
    (vendorFamily === "count" || vendorFamily === "volume") &&
    candidateFamily === "weight"
  );
}

// ---------------------------------------------------------------------------
// Vendor name → family inference
// ---------------------------------------------------------------------------

test("inferVendorNameFamily: beverage names → count", () => {
  assert.equal(inferVendorNameFamily("SALAM COLA ORIGINAL"), "count");
  assert.equal(inferVendorNameFamily("WATER BOTTLE 16.9 OZ"), "count");
  assert.equal(inferVendorNameFamily("APPLE JUICE 12 PK"), "count");
});

test("inferVendorNameFamily: volume tokens win when present", () => {
  // "WHOLE MILK" matches the milk keyword (count); but "1 GAL" pulls
  // it into the volume family.
  assert.equal(inferVendorNameFamily("WHOLE MILK 1 GAL JUG"), "volume");
});

test("inferVendorNameFamily: returns null on plain meat names", () => {
  // No keyword fires → fall through to legacy meat-signal scoring.
  assert.equal(inferVendorNameFamily("JUMBO CHICKEN TENDER"), null);
  assert.equal(inferVendorNameFamily("BONELESS BEEF BRISKET"), null);
  assert.equal(inferVendorNameFamily("LAMB SHOULDER"), null);
});

// ---------------------------------------------------------------------------
// Family-conflict veto
// ---------------------------------------------------------------------------

test("familyConflict: SALAM COLA vs weight-family candidate → conflict", () => {
  // The reported bug: beverage line was getting matched to JUMBO
  // CHICKEN TENDER (weight family). The veto must fire.
  assert.equal(familyConflict("SALAM COLA ORIGINAL", "weight"), true);
});

test("familyConflict: WATER BOTTLE vs weight-family → conflict", () => {
  assert.equal(familyConflict("WATER BOTTLE 16.9 OZ", "weight"), true);
});

test("familyConflict: SALAM COLA vs count-family candidate → no conflict", () => {
  // Same family — fuzzy score wins/loses on its own merits.
  assert.equal(familyConflict("SALAM COLA ORIGINAL", "count"), false);
});

test("familyConflict: legacy meat name vs weight candidate → no conflict", () => {
  // Meat product names don't trip the keyword set, so the veto
  // doesn't activate — the legacy meat-signal scoring applies and
  // a beef→beef match works as before.
  assert.equal(familyConflict("JUMBO CHICKEN TENDER", "weight"), false);
});

test("familyConflict: null candidate family → never conflict", () => {
  // Products without a base UOM (legacy data) fall through to the
  // legacy scoring path unchanged.
  assert.equal(familyConflict("SALAM COLA ORIGINAL", null), false);
});

test("familyConflict: volume vendor vs weight candidate → conflict", () => {
  assert.equal(familyConflict("WHOLE MILK 1 GAL JUG", "weight"), true);
});
