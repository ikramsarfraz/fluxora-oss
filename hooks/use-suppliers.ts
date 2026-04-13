"use client";

import { useQuery } from "@tanstack/react-query";
import { getSuppliers } from "@/lib/api/suppliers";
import { queryKeys } from "@/lib/query/keys";

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: getSuppliers,
    staleTime: 1000 * 60 * 5,
  });
}
