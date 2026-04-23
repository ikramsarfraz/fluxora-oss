"use client";

import { useQuery } from "@tanstack/react-query";

import { getApAgingAction, getArAgingAction } from "@/actions/aging";
import { getDashboardSummaryAction } from "@/actions/dashboard";
import { queryKeys } from "@/lib/query/keys";

// Dashboards aren't hot paths; cache for 2 minutes so clicking around feels
// instant but refreshes often enough to stay useful.
const DASHBOARD_STALE_TIME = 1000 * 60 * 2;

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => getDashboardSummaryAction(),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useArAging() {
  return useQuery({
    queryKey: queryKeys.dashboard.arAging,
    queryFn: () => getArAgingAction(),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useApAging() {
  return useQuery({
    queryKey: queryKeys.dashboard.apAging,
    queryFn: () => getApAgingAction(),
    staleTime: DASHBOARD_STALE_TIME,
  });
}
