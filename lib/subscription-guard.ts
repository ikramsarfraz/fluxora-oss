import {
  getCurrentTenant,
  type CurrentTenant,
} from "@/modules/core/tenants/services/tenants";

import {
  getTenantSubscriptionHealth,
  shouldBlockTenantAccess,
} from "./tenant-subscription-health";

/**
 * Thrown by `requireTenantForMutation` / `assertTenantSubscriptionAllowsMutation`
 * when the tenant's subscription is in a blocking state (canceled or
 * expired). Server actions catch this and surface a "reactivate billing"
 * message; API route handlers translate it to a 402.
 *
 * Read paths must NOT throw this — only mutation entry points should
 * gate. Otherwise tenants can't reach `/account/billing` to fix the
 * problem.
 */
export class SubscriptionBlockedError extends Error {
  /** Hint for `app/api/*` handlers translating to HTTP. */
  readonly statusHint = 402;

  constructor(message?: string) {
    super(
      message ??
        "Your workspace's subscription is canceled or expired. " +
          "Reactivate billing from /account/billing to perform this action.",
    );
    this.name = "SubscriptionBlockedError";
  }
}

/**
 * Synchronous guard for callers that have already loaded the tenant.
 * Throws `SubscriptionBlockedError` when health is canceled / expired.
 *
 * Use this when a service has its own tenant resolution (e.g. a batch
 * job iterating tenants) or when several mutation primitives share an
 * already-loaded tenant inside a transaction.
 */
export function assertTenantSubscriptionAllowsMutation(
  tenant: CurrentTenant,
): void {
  const health = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });
  if (shouldBlockTenantAccess(health)) {
    throw new SubscriptionBlockedError();
  }
}

/**
 * Replacement for `getCurrentTenant()` at the top of any mutating
 * server action / service. Same auth + tenant + session-mismatch
 * checks, plus a subscription-health gate.
 *
 * The layout `(subscription-guard)/layout.tsx` already redirects page
 * navigations for canceled / expired tenants, but `/api/*` route
 * handlers and direct server-action invocations bypass that layout —
 * this guard closes the gap on a per-action basis.
 *
 * Read paths must keep calling `getCurrentTenant()` so blocked tenants
 * can still see (and pay) their bill.
 */
export async function requireTenantForMutation(): Promise<CurrentTenant> {
  const tenant = await getCurrentTenant();
  assertTenantSubscriptionAllowsMutation(tenant);
  return tenant;
}
