"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  dismissTenantSetupChecklistAction,
  getTenantSetupChecklistViewAction,
} from "@/actions/tenant-setup-checklist";
import { queryKeys } from "@/lib/query/keys";

const STALE = 1000 * 60 * 2;

export function useTenantSetupChecklist() {
  return useQuery({
    queryKey: queryKeys.dashboard.setupChecklist,
    queryFn: () => getTenantSetupChecklistViewAction(),
    staleTime: STALE,
  });
}

export function useDismissTenantSetupChecklist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => dismissTenantSetupChecklistAction(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.dashboard.setupChecklist });
    },
  });
}
