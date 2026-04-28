import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import { formatDisplayDate } from "@/lib/utils/date";

/**
 * Matches `@/components/ui/badge` variant names (semantic subscription UI only).
 */
export type SubscriptionBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";


const PLAN_LABEL: Record<TenantSubscriptionPlan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const STATUS_LABEL: Record<TenantSubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  comped: "Comped",
};

export function formatSubscriptionPlanLabel(plan: TenantSubscriptionPlan): string {
  return PLAN_LABEL[plan];
}

export function formatSubscriptionStatusLabel(
  status: TenantSubscriptionStatus,
): string {
  return STATUS_LABEL[status];
}

/** Visual weight for tier badges (not tenant activity). */
export function subscriptionPlanBadgeVariant(
  plan: TenantSubscriptionPlan,
): SubscriptionBadgeVariant {
  switch (plan) {
    case "free":
      return "outline";
    case "starter":
      return "secondary";
    case "growth":
      return "default";
    case "enterprise":
      return "secondary";
  }
}

/** Visual weight keyed to Stripe-ish subscription lifecycle severity. */
export function subscriptionStatusBadgeVariant(
  status: TenantSubscriptionStatus,
): SubscriptionBadgeVariant {
  switch (status) {
    case "trialing":
      return "outline";
    case "active":
      return "default";
    case "past_due":
      return "destructive";
    case "canceled":
      return "outline";
    case "comped":
      return "secondary";
  }
}

/** Display date for billing period / trial timestamps; uses centralized calendar formatting. */
export function formatSubscriptionBillingDate(
  value: string | Date | null | undefined,
): string {
  return formatDisplayDate(value);
}

/** Short copy for trial row (tenant subscription fields mirror Stripe-backed state). */
export function formatSubscriptionTrialLine(
  status: TenantSubscriptionStatus,
  trialEndsAt: Date | string | null | undefined,
): string {
  if (status === "trialing") {
    const d = formatSubscriptionBillingDate(trialEndsAt);
    return d === "—" ? "Active — end date pending" : `Ends ${d}`;
  }
  return "Not in trial";
}

/** Current billing period row (Stripe `current_period_end`-backed cache). */
export function formatSubscriptionCurrentPeriodLine(
  currentPeriodEndsAt: Date | string | null | undefined,
): string {
  return formatSubscriptionBillingDate(currentPeriodEndsAt);
}
