"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getPaymentByIdAction,
  getPaymentsAction,
} from "@/actions/payments";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments.all,
    queryFn: getPaymentsAction,
    staleTime: 1000 * 60,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => getPaymentByIdAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60,
  });
}
