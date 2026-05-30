import type { StripeBillingInterval } from "@/lib/stripe/checkout-plan-schema";
import type { StripeSaasPaidPlanKey } from "@/lib/stripe/plan-metadata";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

/**
 * Pure, client-safe classification of a subscription plan/interval change as
 * either applied **immediately** (upgrade / lateral) or **scheduled** for the
 * end of the current period (downgrade). Used both server-side to route the
 * change (Stripe Customer Portal vs. an in-app subscription schedule) and
 * client-side to label the button. No Stripe/DB imports — types only.
 */

/** Tier ordering; a lower rank is a cheaper plan. */
export const PLAN_RANK: Record<TenantSubscriptionPlan, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  enterprise: 3,
};

export type PlanChangeTiming = "immediate" | "scheduled";

export type CurrentSubscriptionSelection = {
  currentPlan: TenantSubscriptionPlan;
  /** Cadence of the current live subscription, or null when unknown. */
  currentInterval: StripeBillingInterval | null;
};

export type TargetSubscriptionSelection = {
  plan: StripeSaasPaidPlanKey;
  interval: StripeBillingInterval;
};

/**
 * Decide whether moving from the current subscription to the target is applied
 * now or deferred to period end.
 *
 * A change is **scheduled** (period-end downgrade) when:
 * - the target tier rank is lower than the current tier, OR
 * - it's the same tier switching `year → month`.
 *
 * Everything else — higher tier, `month → year`, or no real change — is
 * **immediate**. When `currentInterval` is unknown we can't tell a same-tier
 * `year → month` downgrade apart, so we conservatively treat same-tier changes
 * as immediate.
 */
export function classifyPlanChange(
  current: CurrentSubscriptionSelection,
  target: TargetSubscriptionSelection,
): PlanChangeTiming {
  const currentRank = PLAN_RANK[current.currentPlan];
  const targetRank = PLAN_RANK[target.plan];

  if (targetRank < currentRank) {
    return "scheduled";
  }
  if (targetRank > currentRank) {
    return "immediate";
  }

  // Same tier: only an annual → monthly move is a downgrade.
  if (current.currentInterval === "year" && target.interval === "month") {
    return "scheduled";
  }
  return "immediate";
}
