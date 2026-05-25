import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PostHogIdentify } from "@/components/posthog-identify";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import {
  getTenantSubscriptionHealth,
  shouldBlockTenantAccess,
} from "@/lib/tenant-subscription-health";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";

/**
 * Sibling tree to `(app)` for the cold-start onboarding screen. Lives outside
 * `(app)` so it can render without the tenant sidebar — the `(app)` layout's
 * SidebarProvider must be stable across navigations within `(app)` (the
 * router cache reuses it), so branching its tree on pathname was unsound.
 *
 * Routes here still require auth + a resolvable tenant, and respect the
 * same subscription block as `(app)`.
 */
export default async function OnboardingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });

  if (!session?.user) {
    redirect("/login");
  }

  let tenant: Awaited<ReturnType<typeof getCurrentTenantCached>>;
  try {
    tenant = await getCurrentTenantCached();
  } catch {
    redirect("/login");
  }

  const health = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });
  if (shouldBlockTenantAccess(health)) {
    redirect("/billing-blocked");
  }

  return (
    <TooltipProvider>
      <PostHogIdentify />
      {children}
    </TooltipProvider>
  );
}
