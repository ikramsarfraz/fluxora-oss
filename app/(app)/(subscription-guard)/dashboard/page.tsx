import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { ColdStartWelcome } from "@/components/dashboard/cold-start-welcome";
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
  const [summary] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.dashboard.summary,
      queryFn: () => getDashboardSummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.setupChecklist,
      queryFn: () => getTenantSetupChecklistViewAction(),
    }),
  ]);

  // Cold-start gate: a brand-new tenant with no supplier bills, no sales,
  // and no inventory positions yet. The v3 spec shows a welcome banner +
  // setup checklist above the normal dashboard until those signals flip.
  const isColdStart =
    summary.purchasing.recent.length === 0 &&
    summary.purchasing.unpaid.length === 0 &&
    summary.sales.overTime.every((p) => Number(p.total) === 0) &&
    summary.inventory.byStatus.every((row) => row.itemCount === 0);

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
      {isColdStart && (
        <ColdStartWelcome
          workspaceName={tenant.name}
          ownerFirstName={portalUser.fullName?.trim().split(/\s+/)[0]}
        />
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardShell role={role} />
      </HydrationBoundary>
    </div>
  );
}
