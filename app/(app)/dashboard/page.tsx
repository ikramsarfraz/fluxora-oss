import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { isSectionVisible } from "@/lib/dashboard/visibility";
import { queryKeys } from "@/lib/query/keys";
import { getApAging, getArAging } from "@/services/aging";
import { getDashboardSummary } from "@/services/dashboard";
import { getCurrentPortalUser } from "@/services/portal-users";

import { DashboardShell } from "../(dashboard)/components/dashboard-shell";

export default async function DashboardRoute() {
  const portalUser = await getCurrentPortalUser();
  const role = portalUser.role as PortalUserRole;

  const queryClient = new QueryClient();

  const prefetches: Array<Promise<unknown>> = [
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.summary,
      queryFn: () => getDashboardSummary(),
    }),
  ];
  if (isSectionVisible(role, "arAging")) {
    prefetches.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.arAging,
        queryFn: () => getArAging(),
      }),
    );
  }
  if (isSectionVisible(role, "apAging")) {
    prefetches.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.apAging,
        queryFn: () => getApAging(),
      }),
    );
  }
  await Promise.all(prefetches);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4">
      <div className="px-4 pt-2 lg:px-6">
        <PageHeader
          title="Dashboard"
          description="Overview of sales, purchasing, and inventory health."
        />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardShell role={role} />
      </HydrationBoundary>
    </div>
  );
}
