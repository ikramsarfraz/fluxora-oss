import assert from "node:assert/strict";
import { test } from "node:test";

import { extractPackSizeFromDescription } from "./pack-size";

// ---------------------------------------------------------------------------
// Common invoice patterns the AI tends to preserve in description text.
// These cover the shapes that appeared in real-world bills the user fed
// through the Scan PDF flow.
// ---------------------------------------------------------------------------

test("extractPackSizeFromDescription: '24 (11 oz) cans per case'", () => {
  assert.equal(
    extractPackSizeFromDescription("24 (11 oz) cans per case"),
    24,
  );
});

test("extractPackSizeFromDescription: '12 (12 oz) packets per case'", () => {
  assert.equal(
    extractPackSizeFromDescription("12 (12 oz) packets per case"),
    12,
  );
});

test("extractPackSizeFromDescription: '4 gallons per case'", () => {
  assert.equal(
    extractPackSizeFromDescription("4 gallons per case"),
    4,
  );
});

test("extractPackSizeFromDescription: 'case of 24'", () => {
  assert.equal(extractPackSizeFromDescription("case of 24"), 24);
});

test("extractPackSizeFromDescription: 'case of 6'", () => {
  assert.equal(extractPackSizeFromDescription("case of 6"), 6);
});

test("extractPackSizeFromDescription: '24 PK'", () => {
  assert.equal(extractPackSizeFromDescription("SALAM COLA 24 PK"), 24);
});

test("extractPackSizeFromDescription: '12-pack'", () => {
  assert.equal(extractPackSizeFromDescription("Soda 12-pack"), 12);
});

test("extractPackSizeFromDescription: 'x24' style", () => {
  assert.equal(extractPackSizeFromDescription("Coke x 24"), 24);
});

// ---------------------------------------------------------------------------
// Negative cases — should return null and let the form fall back to the
// product's default purchase-unit conversion.
// ---------------------------------------------------------------------------

test("extractPackSizeFromDescription: empty / null / whitespace → null", () => {
  assert.equal(extractPackSizeFromDescription(null), null);
  assert.equal(extractPackSizeFromDescription(undefined), null);
  assert.equal(extractPackSizeFromDescription(""), null);
  assert.equal(extractPackSizeFromDescription("   "), null);
});

test("extractPackSizeFromDescription: description with no pack signal → null", () => {
  assert.equal(
    extractPackSizeFromDescription("catch-weight, varies by case"),
    null,
  );
  assert.equal(
    extractPackSizeFromDescription("loose singles"),
    null,
  );
});

test("extractPackSizeFromDescription: implausible number (0 / negative / huge) → null", () => {
  // The regex itself wouldn't normally match these, but the clamp is
  // defensive against weird inputs.
  assert.equal(extractPackSizeFromDescription("case of 0"), null);
  assert.equal(extractPackSizeFromDescription("case of 50000"), null);
});

test("extractPackSizeFromDescription: prefers explicit 'N per case' over generic '12 PK' substring", () => {
  // "BEEF FRANKS 12 (12 oz) packets per case" should resolve 12, not
  // double-count via partial 12-pack match. The first pattern in the
  // ordered list wins, which is the explicit per-case form.
  assert.equal(
    extractPackSizeFromDescription("BEEF FRANKS 12 (12 oz) packets per case"),
    12,
  );
});
