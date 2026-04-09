"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomers } from "@/lib/api/customers";
import { queryKeys } from "@/lib/query/keys";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: getCustomers,
    staleTime: 1000 * 60 * 5,
  });
}
