import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  logSubscriptionGuardMissingPathname,
  resolveTenantAppPathname,
} from "@/lib/subscription-guard-pathname";
import {
  getTenantSubscriptionHealth,
  isSubscriptionAccessExemptPath,
  shouldBlockTenantAccess,
} from "@/lib/tenant-subscription-health";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

/**
 * Hard subscription gate for tenant routes. `account/` and `billing-blocked/` live outside this
 * group so canceled/expired tenants can still reach Billing and this unblock screen even when
 * pathname headers are missing (fail closed below).
 *
 * Also enforces the cold-start onboarding redirect: tenants with no posted bills and no
 * explicit skip are sent to /get-started until they post their first bill or dismiss the
 * flow. `/get-started` lives in a sibling `(onboarding)` group so it doesn't hit this layout —
 * any route that reaches here in the onboarding state is, by definition, somewhere else.
 */
export default async function TenantSubscriptionGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const tenant = await getCurrentTenantCached();
  const health = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });

  if (shouldBlockTenantAccess(health)) {
    const pathname = resolveTenantAppPathname(headerList);

    if (!pathname) {
      logSubscriptionGuardMissingPathname({ nodeEnv: process.env.NODE_ENV });
      redirect("/billing-blocked");
    }

    if (!isSubscriptionAccessExemptPath(pathname)) {
      redirect("/billing-blocked");
    }

    return children;
  }

  // Onboarding redirect is owner-only. Invited admins / sales /
  // accountants / warehouse users shouldn't be bounced into a form
  // that overwrites tenant.name + businessCategory — that's the
  // owner's call. Non-owners see whatever guarded route they were
  // headed to (usually the dashboard's empty-state) instead.
  if (tenant.billCount === 0 && !tenant.welcomeSkippedAt) {
    const currentUser = await getCurrentPortalUser();
    if (currentUser.role === "owner") {
      redirect("/get-started");
    }
  }

  return children;
}
