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

/**
 * Hard subscription gate for tenant routes. `account/` and `billing-blocked/` live outside this
 * group so canceled/expired tenants can still reach Billing and this unblock screen even when
 * pathname headers are missing (fail closed below).
 *
 * Also enforces the cold-start onboarding redirect: tenants with no posted bills and no
 * explicit skip are sent to /welcome until they post their first bill or dismiss the flow.
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

  // Subscription gate — resolve pathname once and reuse below if needed.
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

  // Cold-start onboarding gate — redirect to /welcome until first bill is posted or skipped.
  if (tenant.billCount === 0 && !tenant.welcomeSkippedAt) {
    const pathname = resolveTenantAppPathname(headerList);
    if (pathname && pathname !== "/welcome") {
      redirect("/welcome");
    }
  }

  return children;
}
