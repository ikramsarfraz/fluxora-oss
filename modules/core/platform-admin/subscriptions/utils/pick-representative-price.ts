import type { StripeSaasPaidPlanKey } from "@/lib/stripe/plan-metadata";

/**
 * Shape of a cached Stripe price row that `pickRepresentativePrice`
 * cares about. Kept minimal so the function stays trivially testable
 * without pulling in a Drizzle row type (or, transitively, the db
 * client). The fields here line up exactly with what the
 * `subscription-revenue` service reads from `stripe_prices`.
 */
export type RepresentativePriceCandidate = {
  stripePriceId: string;
  billingPlanKey: string | null;
  currency: string;
  unitAmount: number | null;
  recurringInterval: string | null;
  recurringIntervalCount: number | null;
  active: boolean;
};

export type RepresentativePriceResult = {
  stripePriceId: string;
  monthlyUnitAmountCents: number;
  basisInterval: "month" | "year";
  currency: string;
};

/**
 * Given the cached Stripe price catalog, pick a single price to base
 * MRR on for the supplied plan. Used by the platform-admin Revenue
 * card on `/admin/subscriptions`.
 *
 * Selection rules — in order:
 *   1. Only consider prices that are `active`, match the requested
 *      `billing_plan_key`, have a non-null `unit_amount`, and have
 *      `recurring_interval` of either "month" or "year". Anything
 *      else (one-time prices, deactivated rows, prices missing a plan
 *      key, etc.) is skipped.
 *   2. Prefer a monthly price if one exists — it's the most stable
 *      basis for MRR and matches what most plans surface in Stripe.
 *   3. Fall back to an annual price, dividing by 12 (× any
 *      `recurringIntervalCount` multiplier) so an "annual-only" plan
 *      still contributes a sensible monthly figure.
 *   4. Return `null` when no eligible price exists for the plan. The
 *      caller turns that into a warning ("plan has tenants but no
 *      active Stripe price").
 *
 * The function is pure — no DB, no env reads — so it lives here in
 * a util file and is unit-tested in
 * `pick-representative-price.test.ts`.
 */
export function pickRepresentativePrice(
  prices: ReadonlyArray<RepresentativePriceCandidate>,
  plan: StripeSaasPaidPlanKey,
): RepresentativePriceResult | null {
  const eligible = prices.filter(
    p =>
      p.active &&
      p.billingPlanKey === plan &&
      p.unitAmount != null &&
      (p.recurringInterval === "month" || p.recurringInterval === "year"),
  );
  if (eligible.length === 0) return null;

  const monthly = eligible.find(p => p.recurringInterval === "month");
  if (monthly && monthly.unitAmount != null) {
    const count = monthly.recurringIntervalCount ?? 1;
    return {
      stripePriceId: monthly.stripePriceId,
      monthlyUnitAmountCents: Math.round(monthly.unitAmount / count),
      basisInterval: "month",
      currency: monthly.currency,
    };
  }
  const annual = eligible.find(p => p.recurringInterval === "year");
  if (annual && annual.unitAmount != null) {
    const count = annual.recurringIntervalCount ?? 1;
    return {
      stripePriceId: annual.stripePriceId,
      monthlyUnitAmountCents: Math.round(annual.unitAmount / (12 * count)),
      basisInterval: "year",
      currency: annual.currency,
    };
  }
  return null;
}
