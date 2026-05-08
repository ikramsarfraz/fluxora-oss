import type { TenantSubscriptionStatus } from "@/lib/tenant-subscription";
import type Stripe from "stripe";

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): TenantSubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    case "incomplete":
      return "trialing";
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "active";
    default:
      return "active";
  }
}
