import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PRICE_DRIFT_ALERT_PCT,
  PRICE_DRIFT_NOISE_PCT,
  classifyDriftBand,
  flagOutlierPurchases,
  medianOf,
} from "./price-intelligence-thresholds";

// ---------------------------------------------------------------------------
// classifyDriftBand
// ---------------------------------------------------------------------------

test("classifyDriftBand: null/undefined/NaN → 'flat'", () => {
  assert.equal(classifyDriftBand(null), "flat");
  assert.equal(classifyDriftBand(undefined), "flat");
  assert.equal(classifyDriftBand(Number.NaN), "flat");
  assert.equal(classifyDriftBand(Number.POSITIVE_INFINITY), "flat");
});

test("classifyDriftBand: tiny delta is 'flat'", () => {
  // 1% — well under the noise threshold.
  assert.equal(classifyDriftBand(0.01), "flat");
  assert.equal(classifyDriftBand(-0.01), "flat");
});

test("classifyDriftBand: exactly the noise threshold is 'drift'", () => {
  // The boundary is inclusive — 5% counts as drift, not flat. Anchors
  // the public threshold constant to a visible behavior change.
  const at = PRICE_DRIFT_NOISE_PCT / 100;
  assert.equal(classifyDriftBand(at), "drift");
  assert.equal(classifyDriftBand(-at), "drift");
});

test("classifyDriftBand: between noise and alert is 'drift'", () => {
  // 10% — colored text, no banner.
  assert.equal(classifyDriftBand(0.1), "drift");
  assert.equal(classifyDriftBand(-0.1), "drift");
});

test("classifyDriftBand: exactly the alert threshold is 'alert'", () => {
  const at = PRICE_DRIFT_ALERT_PCT / 100;
  assert.equal(classifyDriftBand(at), "alert");
  assert.equal(classifyDriftBand(-at), "alert");
});

test("classifyDriftBand: huge delta is 'alert'", () => {
  // 60% above — banner-level callout.
  assert.equal(classifyDriftBand(0.6), "alert");
  assert.equal(classifyDriftBand(-0.6), "alert");
});

// ---------------------------------------------------------------------------
// medianOf
// ---------------------------------------------------------------------------

test("medianOf: empty array returns null", () => {
  assert.equal(medianOf([]), null);
});

test("medianOf: single value is its own median", () => {
  assert.equal(medianOf([4]), 4);
});

test("medianOf: odd count picks the middle", () => {
  // Sorted: [1, 2, 9] → median 2. Order of input shouldn't matter.
  assert.equal(medianOf([9, 1, 2]), 2);
});

test("medianOf: even count averages the two middle values", () => {
  // Sorted: [1, 2, 8, 10] → average of 2 + 8 = 5.
  assert.equal(medianOf([10, 2, 1, 8]), 5);
});

test("medianOf: NaN and Infinity are filtered before computing", () => {
  // [2, 4, NaN, Infinity] → finite=[2, 4] → median = 3.
  assert.equal(medianOf([2, 4, Number.NaN, Number.POSITIVE_INFINITY]), 3);
});

// ---------------------------------------------------------------------------
// flagOutlierPurchases
// ---------------------------------------------------------------------------

test("flagOutlierPurchases: nothing flagged when prices are tight", () => {
  // All within ±50% of median (10). Nothing should flip.
  const tagged = flagOutlierPurchases([
    { unitPrice: 9 },
    { unitPrice: 10 },
    { unitPrice: 11 },
  ]);
  assert.ok(tagged.every(t => !t.isOutlier));
});

test("flagOutlierPurchases: a 3x outlier above the median is flagged", () => {
  // Median of [10, 10, 10, 30] = 10 → cap at 15. The 30 is past +50%.
  const tagged = flagOutlierPurchases([
    { unitPrice: 10 },
    { unitPrice: 10 },
    { unitPrice: 10 },
    { unitPrice: 30 },
  ]);
  assert.equal(tagged.find(t => t.unitPrice === 30)?.isOutlier, true);
  assert.equal(tagged.find(t => t.unitPrice === 10)?.isOutlier, false);
});

test("flagOutlierPurchases: a tiny outlier below the median is flagged", () => {
  // Decimal-in-wrong-place case: $0.50 amid a baseline around $5.
  // Median = 5, floor = 2.5. 0.50 < 2.5 → outlier.
  const tagged = flagOutlierPurchases([
    { unitPrice: 5 },
    { unitPrice: 5 },
    { unitPrice: 5 },
    { unitPrice: 0.5 },
  ]);
  assert.equal(tagged.find(t => t.unitPrice === 0.5)?.isOutlier, true);
});

test("flagOutlierPurchases: with only two rows, median catches the bad one", () => {
  // [10, 30] median = 20 → caps are 10 and 30 inclusive. Neither
  // strictly outside the band, so neither flips. Documents the
  // n=2 boundary so a future change is explicit.
  const tagged = flagOutlierPurchases([{ unitPrice: 10 }, { unitPrice: 30 }]);
  assert.ok(tagged.every(t => !t.isOutlier));
});

test("flagOutlierPurchases: empty input returns empty array", () => {
  const tagged = flagOutlierPurchases([]);
  assert.deepEqual(tagged, []);
});

test("flagOutlierPurchases: median ≤ 0 leaves all rows untagged (defensive)", () => {
  // If somehow every purchase is at 0, the band collapses to a single
  // point and a strict |x| > 0 check would mark every non-zero row.
  // The helper short-circuits in this case to avoid false positives.
  const tagged = flagOutlierPurchases([
    { unitPrice: 0 },
    { unitPrice: 0 },
    { unitPrice: 5 },
  ]);
  assert.ok(tagged.every(t => !t.isOutlier));
});

test("flagOutlierPurchases: preserves extra fields on each row", () => {
  // The generic shape lets callers pass through supplier metadata.
  const tagged = flagOutlierPurchases([
    { unitPrice: 10, supplierName: "Acme", date: "2026-05-01" },
    { unitPrice: 10, supplierName: "Beta", date: "2026-05-02" },
  ]);
  assert.equal(tagged[0].supplierName, "Acme");
  assert.equal(tagged[1].date, "2026-05-02");
});
