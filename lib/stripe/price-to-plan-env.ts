import type { StripeSaasPaidPlanKey } from "@/lib/stripe/plan-metadata";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

export function tryTenantPlanFromEnvPriceId(
  priceId: string,
): TenantSubscriptionPlan | null {
  const s = process.env.STRIPE_PRICE_STARTER?.trim();
  const g = process.env.STRIPE_PRICE_GROWTH?.trim();
  const e = process.env.STRIPE_PRICE_ENTERPRISE?.trim();
  const id = priceId.trim();
  if (id === s) {
    return "starter";
  }
  if (id === g) {
    return "growth";
  }
  if (id === e) {
    return "enterprise";
  }
  return null;
}

/** Env-only mapping (STRIPE_PRICE_*). Throws if no match. */
export function tenantPlanFromEnvPriceId(priceId: string): TenantSubscriptionPlan {
  const resolved = tryTenantPlanFromEnvPriceId(priceId);
  if (!resolved) {
    throw new Error(`Unmapped Stripe price id: ${priceId}`);
  }
  return resolved;
}

export function stripePriceIdForPaidPlanFromEnv(plan: StripeSaasPaidPlanKey): string {
  const id =
    plan === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : plan === "growth"
        ? process.env.STRIPE_PRICE_GROWTH
        : process.env.STRIPE_PRICE_ENTERPRISE;
  const trimmed = id?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing or empty Stripe price env for plan "${plan}" (STRIPE_PRICE_${plan.toUpperCase()}).`,
    );
  }
  return trimmed;
}
