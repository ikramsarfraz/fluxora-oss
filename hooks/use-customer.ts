"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomer } from "@/lib/api/customers";
import { queryKeys } from "@/lib/query/keys";

export function useCustomer(id: number) {
  console.log("useCustomer", id);
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomer(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
