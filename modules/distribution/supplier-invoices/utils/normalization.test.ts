import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeProductName,
  normalizeSupplierName,
  normalizeInvoiceNumber,
  normalizeWeightString,
  normalizeCurrencyString,
  fuzzyScore,
  levenshteinDistance,
} from "./normalization";

// ---------------------------------------------------------------------------
// normalizeProductName
// ---------------------------------------------------------------------------

test("normalizeProductName: lowercase and trim", () => {
  assert.equal(normalizeProductName("  CHICKEN BREAST  "), "chicken breast");
});

test("normalizeProductName: expands shldr → shoulder", () => {
  assert.equal(normalizeProductName("Lamb Shldr"), "lamb shoulder");
});

test("normalizeProductName: expands b/i → bone in", () => {
  assert.equal(normalizeProductName("B/I Lamb"), "bone in lamb");
});

test("normalizeProductName: expands b/l → boneless", () => {
  assert.equal(normalizeProductName("B/L Chicken"), "boneless chicken");
});

test("normalizeProductName: expands bnls → boneless", () => {
  assert.equal(normalizeProductName("Bnls Chicken Thighs"), "boneless chicken thigh");
});

test("normalizeProductName: expands imp → imported", () => {
  assert.equal(normalizeProductName("Lamb Shldrs Imp"), "lamb shoulder imported");
});

test("normalizeProductName: expands frz → frozen", () => {
  assert.equal(normalizeProductName("FRZ Beef"), "frozen beef");
});

test("normalizeProductName: expands whl → whole", () => {
  assert.equal(normalizeProductName("WHL Chicken"), "whole chicken");
});

test("normalizeProductName: collapses punctuation to spaces", () => {
  assert.equal(normalizeProductName("beef—prime/rib"), "beef prime rib");
});

test("normalizeProductName: returns empty string for empty input", () => {
  assert.equal(normalizeProductName(""), "");
  assert.equal(normalizeProductName("   "), "");
});

// ---------------------------------------------------------------------------
// normalizeSupplierName
// ---------------------------------------------------------------------------

test("normalizeSupplierName: uppercase and strip business suffixes", () => {
  assert.equal(normalizeSupplierName("SUMMIT TRADING LLC"), "SUMMIT TRADING");
});

test("normalizeSupplierName: normalizes & to AND", () => {
  assert.equal(normalizeSupplierName("Smith & Sons"), "SMITH AND SONS");
});

test("normalizeSupplierName: strips INC suffix", () => {
  assert.equal(normalizeSupplierName("Brewer Livestock Inc"), "BREWER LIVESTOCK");
});

// ---------------------------------------------------------------------------
// normalizeInvoiceNumber
// ---------------------------------------------------------------------------

test("normalizeInvoiceNumber: strips non-alphanumeric except dash", () => {
  assert.equal(normalizeInvoiceNumber("INV-12345/A"), "INV-12345A");
});

test("normalizeInvoiceNumber: uppercases letters", () => {
  assert.equal(normalizeInvoiceNumber("inv-123"), "INV-123");
});

test("normalizeInvoiceNumber: returns empty for empty input", () => {
  assert.equal(normalizeInvoiceNumber(""), "");
});

// ---------------------------------------------------------------------------
// normalizeWeightString
// ---------------------------------------------------------------------------

test("normalizeWeightString: parses weight with LBS suffix", () => {
  assert.equal(normalizeWeightString("34.48 LBS"), "34.4800");
});

test("normalizeWeightString: parses plain decimal", () => {
  assert.equal(normalizeWeightString("100.5"), "100.5000");
});

test("normalizeWeightString: returns empty for non-numeric", () => {
  assert.equal(normalizeWeightString("N/A"), "");
});

// ---------------------------------------------------------------------------
// normalizeCurrencyString
// ---------------------------------------------------------------------------

test("normalizeCurrencyString: strips $ and commas", () => {
  assert.equal(normalizeCurrencyString("$1,234.56"), "1234.56");
});

test("normalizeCurrencyString: handles plain number", () => {
  assert.equal(normalizeCurrencyString("99.99"), "99.99");
});

test("normalizeCurrencyString: returns empty for invalid", () => {
  assert.equal(normalizeCurrencyString(""), "");
  assert.equal(normalizeCurrencyString("N/A"), "");
});

// ---------------------------------------------------------------------------
// levenshteinDistance
// ---------------------------------------------------------------------------

test("levenshteinDistance: identical strings = 0", () => {
  assert.equal(levenshteinDistance("chicken", "chicken"), 0);
});

test("levenshteinDistance: single substitution", () => {
  assert.equal(levenshteinDistance("kitten", "sitten"), 1);
});

test("levenshteinDistance: empty strings", () => {
  assert.equal(levenshteinDistance("", "abc"), 3);
  assert.equal(levenshteinDistance("abc", ""), 3);
  assert.equal(levenshteinDistance("", ""), 0);
});

// ---------------------------------------------------------------------------
// fuzzyScore
// ---------------------------------------------------------------------------

test("fuzzyScore: identical normalized names = 100", () => {
  assert.equal(fuzzyScore("Chicken Breast", "Chicken Breast"), 100);
});

test("fuzzyScore: abbreviation expansion match", () => {
  const score = fuzzyScore("B/I Lamb Shldr", "bone in lamb shoulder");
  assert.ok(score >= 85, `Expected >= 85, got ${score}`);
});

test("fuzzyScore: partial token overlap returns mid score", () => {
  const score = fuzzyScore("JUMBO CHICKEN TENDER", "Chicken Tender");
  assert.ok(score >= 60, `Expected >= 60, got ${score}`);
});

test("fuzzyScore: completely different names = 0", () => {
  assert.equal(fuzzyScore("Beef Brisket", "Chicken Wings"), 0);
});

test("fuzzyScore: empty strings = 0", () => {
  assert.equal(fuzzyScore("", "chicken"), 0);
  assert.equal(fuzzyScore("chicken", ""), 0);
});
