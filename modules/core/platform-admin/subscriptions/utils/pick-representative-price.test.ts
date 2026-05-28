import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pickRepresentativePrice,
  type RepresentativePriceCandidate,
} from "./pick-representative-price";

function priceRow(
  override: Partial<RepresentativePriceCandidate>,
): RepresentativePriceCandidate {
  return {
    stripePriceId: "price_default",
    billingPlanKey: "starter",
    currency: "usd",
    unitAmount: 2900,
    recurringInterval: "month",
    recurringIntervalCount: 1,
    active: true,
    ...override,
  };
}

// ---------------------------------------------------------------------------
// Happy path — monthly preferred when present
// ---------------------------------------------------------------------------

test("monthly price wins over a sibling annual price for the same plan", () => {
  const monthly = priceRow({
    stripePriceId: "price_starter_monthly",
    unitAmount: 2900,
    recurringInterval: "month",
  });
  const annual = priceRow({
    stripePriceId: "price_starter_annual",
    unitAmount: 29000,
    recurringInterval: "year",
  });

  const result = pickRepresentativePrice([annual, monthly], "starter");

  assert.deepEqual(result, {
    stripePriceId: "price_starter_monthly",
    monthlyUnitAmountCents: 2900,
    basisInterval: "month",
    currency: "usd",
  });
});

test("monthly with recurringIntervalCount > 1 divides into a per-month basis", () => {
  // A "billed every 3 months at $90" price should report a $30/mo basis.
  const quarterlyMonthly = priceRow({
    stripePriceId: "price_quarterly",
    unitAmount: 9000,
    recurringInterval: "month",
    recurringIntervalCount: 3,
  });

  const result = pickRepresentativePrice([quarterlyMonthly], "starter");

  assert.equal(result?.monthlyUnitAmountCents, 3000);
  assert.equal(result?.basisInterval, "month");
});

// ---------------------------------------------------------------------------
// Annual fallback when no monthly exists
// ---------------------------------------------------------------------------

test("annual-only price divides by 12 for the monthly basis", () => {
  const annual = priceRow({
    stripePriceId: "price_starter_annual_only",
    unitAmount: 30000,
    recurringInterval: "year",
  });

  const result = pickRepresentativePrice([annual], "starter");

  assert.deepEqual(result, {
    stripePriceId: "price_starter_annual_only",
    monthlyUnitAmountCents: 2500,
    basisInterval: "year",
    currency: "usd",
  });
});

test("annual with recurringIntervalCount > 1 divides by (12 * count)", () => {
  // A "billed every 2 years at $48000" price → $48000 / 24 = $2000/mo.
  const biennial = priceRow({
    stripePriceId: "price_biennial",
    unitAmount: 48000,
    recurringInterval: "year",
    recurringIntervalCount: 2,
  });

  const result = pickRepresentativePrice([biennial], "starter");

  assert.equal(result?.monthlyUnitAmountCents, 2000);
  assert.equal(result?.basisInterval, "year");
});

test("annual basis rounds half-up via Math.round (non-divisible values)", () => {
  // $99/year ÷ 12 = $8.25 → 825 cents rounded.
  const annualOddCents = priceRow({
    stripePriceId: "price_odd",
    unitAmount: 9900,
    recurringInterval: "year",
  });

  const result = pickRepresentativePrice([annualOddCents], "starter");

  assert.equal(result?.monthlyUnitAmountCents, 825);
});

// ---------------------------------------------------------------------------
// Filtering — ineligible rows are skipped
// ---------------------------------------------------------------------------

test("inactive prices are skipped even when otherwise eligible", () => {
  const inactiveMonthly = priceRow({
    stripePriceId: "price_inactive",
    active: false,
  });

  const result = pickRepresentativePrice([inactiveMonthly], "starter");

  assert.equal(result, null);
});

test("prices for a different plan are skipped", () => {
  const growthMonthly = priceRow({
    stripePriceId: "price_growth",
    billingPlanKey: "growth",
  });

  const result = pickRepresentativePrice([growthMonthly], "starter");

  assert.equal(result, null);
});

test("prices with a null billingPlanKey are skipped", () => {
  // Stripe products that haven't been tagged with metadata.plan yet
  // come back with a null billingPlanKey. We can't safely map them
  // to a SaaS plan, so they're excluded.
  const untagged = priceRow({
    stripePriceId: "price_untagged",
    billingPlanKey: null,
  });

  const result = pickRepresentativePrice([untagged], "starter");

  assert.equal(result, null);
});

test("prices with a null unitAmount are skipped", () => {
  // Stripe sometimes returns `unit_amount: null` for tiered or
  // metered prices. We can't compute MRR off a null, so they're
  // excluded.
  const nullAmount = priceRow({
    stripePriceId: "price_no_amount",
    unitAmount: null,
  });

  const result = pickRepresentativePrice([nullAmount], "starter");

  assert.equal(result, null);
});

test("prices with a non-recurring interval are skipped", () => {
  // One-time prices have recurringInterval = null; only month/year
  // map onto an MRR basis here.
  const oneTime = priceRow({
    stripePriceId: "price_one_time",
    recurringInterval: null,
    recurringIntervalCount: null,
  });

  const result = pickRepresentativePrice([oneTime], "starter");

  assert.equal(result, null);
});

test("an empty price list returns null", () => {
  const result = pickRepresentativePrice([], "starter");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Selection only considers the requested plan
// ---------------------------------------------------------------------------

test("siblings on other plans don't leak through when the matching plan has only annual", () => {
  // The catalog has a starter-monthly, but we ask for "growth" which
  // only has an annual. Should fall back to the growth annual, not
  // the starter monthly.
  const starterMonthly = priceRow({
    stripePriceId: "price_starter_monthly",
    billingPlanKey: "starter",
    unitAmount: 2900,
    recurringInterval: "month",
  });
  const growthAnnual = priceRow({
    stripePriceId: "price_growth_annual",
    billingPlanKey: "growth",
    unitAmount: 120000,
    recurringInterval: "year",
  });

  const result = pickRepresentativePrice(
    [starterMonthly, growthAnnual],
    "growth",
  );

  assert.equal(result?.stripePriceId, "price_growth_annual");
  assert.equal(result?.basisInterval, "year");
  assert.equal(result?.monthlyUnitAmountCents, 10000);
});

test("currency is taken from the selected price row, not a sibling", () => {
  // Mixed-currency catalog — make sure the result's currency tracks
  // the actually-picked row.
  const usdMonthly = priceRow({
    stripePriceId: "price_usd",
    currency: "usd",
    unitAmount: 2900,
    recurringInterval: "month",
  });
  const eurAnnual = priceRow({
    stripePriceId: "price_eur",
    currency: "eur",
    unitAmount: 30000,
    recurringInterval: "year",
  });

  const result = pickRepresentativePrice([eurAnnual, usdMonthly], "starter");

  assert.equal(result?.currency, "usd");
});
