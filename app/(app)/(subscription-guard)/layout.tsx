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
import { getCurrentTenantCached } from "@/services/tenants";

/**
 * Hard subscription gate for tenant routes. `account/` and `billing-blocked/` live outside this
 * group so canceled/expired tenants can still reach Billing and this unblock screen even when
 * pathname headers are missing (fail closed below).
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

  if (!shouldBlockTenantAccess(health)) {
    return children;
  }

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
