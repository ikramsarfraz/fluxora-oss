"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomerAction } from "@/app/(app)/customers/customer.actions";
import { queryKeys } from "@/lib/query/keys";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomerAction(id),
    enabled: !!id && UUID_RE.test(id),
    staleTime: 1000 * 60 * 5,
  });
}
