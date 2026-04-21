"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomerAction } from "@/actions/customers";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomerAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}
