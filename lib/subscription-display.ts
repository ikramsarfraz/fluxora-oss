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

const CARD_BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function formatCardBrandLabel(brand: string): string {
  const key = brand.trim().toLowerCase();
  if (CARD_BRAND_LABEL[key]) {
    return CARD_BRAND_LABEL[key];
  }
  if (!key) {
    return "Card";
  }
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

/** e.g. "Visa •••• 4242". */
export function formatTenantPaymentMethodSummary(pm: {
  brand: string;
  last4: string;
}): string {
  return `${formatCardBrandLabel(pm.brand)} •••• ${pm.last4}`;
}

/** e.g. "Expires 04/2028". */
export function formatTenantPaymentMethodExpiryLine(pm: {
  expMonth: number;
  expYear: number;
}): string {
  const m = Number(pm.expMonth);
  const y = Number(pm.expYear);
  const monthPart = Number.isFinite(m)
    ? String(Math.min(99, Math.max(0, Math.floor(m)))).padStart(2, "0")
    : "—";
  const yearPart = Number.isFinite(y) ? String(Math.floor(y)) : "—";
  return `Expires ${monthPart}/${yearPart}`;
}
