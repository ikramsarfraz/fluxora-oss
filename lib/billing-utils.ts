import type { TenantSubscriptionPlan, TenantSubscriptionStatus } from "@/lib/tenant-subscription";

// ============================================================================
// Billing Banner State Types & Derivation
// ============================================================================

export type BillingBannerState = "past_due" | "canceled" | "expired" | "trialing_soon" | "no_subscription";

/**
 * Derives the appropriate billing banner state based on tenant subscription data.
 * This is a pure function that can be used on both server and client.
 */
export function deriveBillingBannerState(input: {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | string | null | undefined;
}): BillingBannerState | null {
  const { subscriptionPlan, subscriptionStatus, trialEndsAt } = input;

  if (subscriptionStatus === "past_due") {
    return "past_due";
  }

  if (subscriptionStatus === "canceled") {
    return "canceled";
  }

  // Check for expired trial
  if (subscriptionStatus === "trialing" && trialEndsAt) {
    const endMs = typeof trialEndsAt === "string" ? new Date(trialEndsAt).getTime() : trialEndsAt.getTime();
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return "expired";
    }
    // Check for trial ending soon (within 7 days)
    const daysRemaining = (endMs - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysRemaining > 0 && daysRemaining <= 7) {
      return "trialing_soon";
    }
  }

  if (subscriptionPlan === "free") {
    return "no_subscription";
  }

  return null;
}
