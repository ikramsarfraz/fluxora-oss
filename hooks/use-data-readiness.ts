"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { DataReadinessContext, DataReadinessFlag, DataReadinessResult } from "@/modules/distribution/lots/services/data-readiness";
import { checkDataReadiness } from "@/modules/distribution/lots/services/data-readiness";

export function useDataReadiness(
  flag: DataReadinessFlag,
  context: DataReadinessContext = {},
): DataReadinessResult & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dataReadiness.flag(flag, context as Record<string, string>),
    queryFn: () => checkDataReadiness(flag, context),
    staleTime: 5 * 60 * 1000,
  });

  return {
    ready: data?.ready ?? false,
    current: data?.current ?? 0,
    needed: data?.needed ?? 1,
    unlockLabel: data?.unlockLabel ?? "",
    isLoading,
  };
}
