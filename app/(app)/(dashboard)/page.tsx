import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { queryKeys } from "@/lib/query/keys";
import { getApAging, getArAging } from "@/services/aging";
import { getDashboardSummary } from "@/services/dashboard";

import { DashboardShell } from "./components/dashboard-shell";

export default async function DashboardRoute() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.summary,
      queryFn: () => getDashboardSummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.arAging,
      queryFn: () => getArAging(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.apAging,
      queryFn: () => getApAging(),
    }),
  ]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4">
      <div className="px-4 pt-2 lg:px-6">
        <PageHeader
          title="Dashboard"
          description="Overview of sales, purchasing, and inventory health."
        />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardShell />
      </HydrationBoundary>
    </div>
  );
}
