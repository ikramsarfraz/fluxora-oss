"use client";

import { useQuery } from "@tanstack/react-query";

import { getDashboardSummaryAction } from "@/actions/dashboard";
import { queryKeys } from "@/lib/query/keys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => getDashboardSummaryAction(),
    // Dashboards aren't hot paths; cache for 2 minutes so clicking around
    // feels instant but refreshes often enough to stay useful.
    staleTime: 1000 * 60 * 2,
  });
}
