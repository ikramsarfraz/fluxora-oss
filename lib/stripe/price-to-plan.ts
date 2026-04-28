import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

const PAID: Array<"starter" | "growth" | "enterprise"> = [
  "starter",
  "growth",
  "enterprise",
];

/**
 * Resolves a Stripe Price id to a tenant plan. Throws if the price is not in env.
 */
export function planFromStripePriceId(priceId: string): TenantSubscriptionPlan {
  const s = process.env.STRIPE_PRICE_STARTER?.trim();
  const g = process.env.STRIPE_PRICE_GROWTH?.trim();
  const e = process.env.STRIPE_PRICE_ENTERPRISE?.trim();
  if (priceId === s) {
    return "starter";
  }
  if (priceId === g) {
    return "growth";
  }
  if (priceId === e) {
    return "enterprise";
  }
  throw new Error(`Unmapped Stripe price id: ${priceId}`);
}

export function getStripePriceIdForPlan(
  plan: (typeof PAID)[number],
): string {
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

export const STRIPE_CHECKOUT_PLANS = PAID;
