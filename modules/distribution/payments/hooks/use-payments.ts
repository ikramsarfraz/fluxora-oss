"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPaymentByIdAction,
  getPaymentsAction,
  getPaymentsPageAction,
  getPaymentsSummaryAction,
  updatePaymentAction,
  voidPaymentAction,
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

/** Invalidate every cache touched when a payment row mutates. */
function invalidatePaymentCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  paymentId: string,
  invoiceId: string,
) {
  // Payment itself + listing + summary all rebuild from scratch.
  queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
  queryClient.invalidateQueries({
    queryKey: queryKeys.payments.detail(paymentId),
  });
  // Parent invoice's Paid / Balance due / status all change.
  queryClient.invalidateQueries({
    queryKey: queryKeys.invoices.detail(invoiceId),
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
  // AR aging + dashboard summary depend on invoice balances.
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.arAging });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
  // Sales-order pages also embed invoice totals.
  queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
}

export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: voidPaymentAction,
    onSuccess: (result, paymentId) => {
      invalidatePaymentCaches(queryClient, paymentId, result.invoiceId);
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePaymentAction,
    onSuccess: (result, variables) => {
      invalidatePaymentCaches(queryClient, variables.id, result.invoiceId);
    },
  });
}
