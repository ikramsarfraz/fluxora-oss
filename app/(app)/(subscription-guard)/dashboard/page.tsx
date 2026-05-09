import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { TenantSubscriptionHealthBanner } from "@/modules/core/billing/components/subscription/tenant-subscription-health-banner";
import { PageHeader } from "@/components/page-header";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { getTenantSubscriptionHealth } from "@/lib/tenant-subscription-health";
import { queryKeys } from "@/lib/query/keys";
import { getDashboardSummary } from "@/modules/distribution/services/dashboard";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getTenantSetupChecklistViewAction } from "@/modules/core/workspace-settings/actions";

import { DashboardShell } from "../(dashboard)/components/dashboard-shell";

export default async function DashboardRoute() {
  const [portalUser, tenant] = await Promise.all([
    getCurrentPortalUser(),
    getCurrentTenantCached(),
  ]);
  const role = portalUser.role as PortalUserRole;
  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";
  const tenantBillingSnapshot = {
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  };
  const subscriptionHealth = getTenantSubscriptionHealth(tenantBillingSnapshot);

  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.summary,
      queryFn: () => getDashboardSummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.setupChecklist,
      queryFn: () => getTenantSetupChecklistViewAction(),
    }),
  ]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4">
      <div className="px-4 pt-2 lg:px-6">
        <PageHeader
          title="Dashboard"
          description="Key metrics and recent sales activity."
        />
      </div>
      <div className="px-4 lg:px-6">
        <TenantSubscriptionHealthBanner
          health={subscriptionHealth}
          tenantFields={tenantBillingSnapshot}
          canManageBilling={canManageBilling}
        />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardShell role={role} />
      </HydrationBoundary>
    </div>
  );
}
