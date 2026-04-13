"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupplier } from "@/lib/api/suppliers";
import { queryKeys } from "@/lib/query/keys";

export function useSupplier(id: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: () => getSupplier(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
