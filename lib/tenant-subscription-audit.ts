import { tenants } from "@/db/schema";
import type { TenantSubscriptionPlan, TenantSubscriptionStatus } from "@/lib/tenant-subscription";

export type SubscriptionFieldSnapshot = {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export const SUBSCRIPTION_AUDIT_KEYS = [
  "subscriptionPlan",
  "subscriptionStatus",
  "trialEndsAt",
  "currentPeriodEndsAt",
  "stripeCustomerId",
  "stripeSubscriptionId",
] as const;

export function subscriptionSnapshotFromRow(
  row: typeof tenants.$inferSelect,
): SubscriptionFieldSnapshot {
  return {
    subscriptionPlan: row.subscriptionPlan,
    subscriptionStatus: row.subscriptionStatus,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodEndsAt: row.currentPeriodEndsAt?.toISOString() ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
  };
}

export function diffSubscriptionKeys(
  before: SubscriptionFieldSnapshot,
  after: SubscriptionFieldSnapshot,
): (typeof SUBSCRIPTION_AUDIT_KEYS)[number][] {
  const changed: (typeof SUBSCRIPTION_AUDIT_KEYS)[number][] = [];
  for (const k of SUBSCRIPTION_AUDIT_KEYS) {
    if (before[k] !== after[k]) {
      changed.push(k);
    }
  }
  return changed;
}
