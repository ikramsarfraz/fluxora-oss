import type Stripe from "stripe";

/** SaaS paid tiers — matches `tenant_subscription_plan` (excluding free). */
export const STRIPE_SAAS_PAID_PLAN_KEYS = ["starter", "growth", "enterprise"] as const;

export type StripeSaasPaidPlanKey = (typeof STRIPE_SAAS_PAID_PLAN_KEYS)[number];

/** Metadata convention: single key `plan` with value starter | growth | enterprise (set on Stripe Price or Product). */
export const STRIPE_METADATA_PLAN_KEY = "plan" as const;

function normalizePlanValue(raw: string | undefined | null): StripeSaasPaidPlanKey | null {
  const v = raw?.trim().toLowerCase();
  if (
    v === "starter" ||
    v === "growth" ||
    v === "enterprise"
  ) {
    return v;
  }
  return null;
}

export function parseBillingPlanFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined,
): StripeSaasPaidPlanKey | null {
  const m = metadata as Record<string, string | undefined> | null | undefined;
  if (!m) {
    return null;
  }
  return normalizePlanValue(m[STRIPE_METADATA_PLAN_KEY]);
}
