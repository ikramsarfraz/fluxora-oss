import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";

export type TenantSubscriptionHealth =
  | "good"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "free";

/** Minimal billing fields needed for subscription health helpers. */
export type TenantSubscriptionHealthInput = {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | string | null | undefined;
  currentPeriodEndsAt: Date | string | null | undefined;
};

/** Trialing workspaces can show “trial ending soon” when ending within this many days. */
export const TRIAL_ENDING_SOON_DAYS = 7;

export function parseSubscriptionDateMs(
  value: Date | string | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  const d = typeof value === "string" ? new Date(value) : value;
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

const PAID_PLANS: TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];

/**
 * Derives a coarse lifecycle label for dashboards and admins. Intended for UX only (no blocking).
 *
 * Ordering accounts for Stripe/webhook staleness when local rows lag behind Stripe.
 */
export function getTenantSubscriptionHealth(
  tenant: TenantSubscriptionHealthInput,
  referenceTime: number = Date.now(),
): TenantSubscriptionHealth {
  const status = tenant.subscriptionStatus;
  const plan = tenant.subscriptionPlan;

  if (status === "comped") {
    return "good";
  }

  if (status === "past_due") {
    return "past_due";
  }

  if (status === "canceled") {
    return "canceled";
  }

  const trialMs = parseSubscriptionDateMs(tenant.trialEndsAt);
  const periodMs = parseSubscriptionDateMs(tenant.currentPeriodEndsAt);

  /** Trial end date elapsed while Stripe still reports trialing (or laggy sync). */
  if (status === "trialing" && trialMs !== null && trialMs < referenceTime) {
    return "expired";
  }

  /** Paid tier with a persisted period end in the past and no active reconcile yet. */
  if (
    PAID_PLANS.includes(plan) &&
    periodMs !== null &&
    periodMs < referenceTime &&
    status !== "active"
  ) {
    return "expired";
  }

  if (plan === "free") {
    return "free";
  }

  if (status === "trialing") {
    return "trialing";
  }

  return "good";
}

export function formatTenantSubscriptionHealthLabel(
  health: TenantSubscriptionHealth,
): string {
  switch (health) {
    case "good":
      return "Healthy";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired / lapsed";
    case "free":
      return "Free";
  }
}

/**
 * Active trial with end date approaching (exclusive of already-elapsed trials).
 */
export function isTrialEndingWithinDays(
  tenant: TenantSubscriptionHealthInput,
  days = TRIAL_ENDING_SOON_DAYS,
  referenceTime = Date.now(),
): boolean {
  if (tenant.subscriptionStatus !== "trialing") {
    return false;
  }
  const endMs = parseSubscriptionDateMs(tenant.trialEndsAt);
  if (endMs === null) {
    return false;
  }
  if (endMs <= referenceTime) {
    return false;
  }
  const remainingDays = (endMs - referenceTime) / (1000 * 60 * 60 * 24);
  return remainingDays > 0 && remainingDays <= days;
}

/** Workspace cannot use the tenant app shell until billing is repaired (minimal hard enforcement). */
export function shouldBlockTenantAccess(
  health: TenantSubscriptionHealth,
): boolean {
  return health === "canceled" || health === "expired";
}

/**
 * Paths reachable while subscription health would otherwise block `(app)` (billing +
 * unblock screen + Stripe rewrite aliases).
 */
export function isSubscriptionAccessExemptPath(pathname: string): boolean {
  const raw = pathname.trim();
  const p =
    raw === "" || raw === "." ? "/" : raw.startsWith("/") ? raw : `/${raw}`;

  if (p === "/billing-blocked" || p.startsWith("/billing-blocked/")) {
    return true;
  }
  // Tenant billing now lives under /settings/billing; keep blocked tenants
  // able to reach it (and the /admin/billing alias) so they can self-resolve.
  if (p === "/settings/billing" || p.startsWith("/settings/billing/")) {
    return true;
  }
  if (p === "/admin/billing" || p.startsWith("/admin/billing/")) {
    return true;
  }
  if (p === "/tenant-admin/billing" || p.startsWith("/tenant-admin/billing/")) {
    return true;
  }
  return false;
}
