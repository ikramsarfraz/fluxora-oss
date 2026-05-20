"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getPaymentByIdAction,
  getPaymentsAction,
  getPaymentsPageAction,
  getPaymentsSummaryAction,
} from "@/modules/distribution/payments/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type {
  PaymentFilters,
  PaymentListParams,
} from "@/modules/distribution/payments/services/payments";

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments.all,
    queryFn: getPaymentsAction,
    staleTime: 1000 * 60,
  });
}

export function usePaymentsPage(params: PaymentListParams) {
  return useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => getPaymentsPageAction(params),
    placeholderData: previousData => previousData,
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

export function usePaymentsSummary(filters: PaymentFilters, search: string) {
  return useQuery({
    queryKey: [...queryKeys.payments.all, "summary", filters, search] as const,
    queryFn: () => getPaymentsSummaryAction(filters, search),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60,
  });
}
