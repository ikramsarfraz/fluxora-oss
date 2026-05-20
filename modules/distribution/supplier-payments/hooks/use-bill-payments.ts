"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getBillPaymentByIdAction,
  getBillPaymentsPageAction,
  getBillPaymentsSummaryAction,
  getOpenBillsForPaymentAction,
} from "@/modules/distribution/supplier-payments/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type {
  BillPaymentFilters,
  BillPaymentListParams,
} from "@/modules/distribution/supplier-payments/services/supplier-payments";

export function useBillPaymentsPage(params: BillPaymentListParams) {
  return useQuery({
    queryKey: queryKeys.billPayments.list(params),
    queryFn: () => getBillPaymentsPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60,
  });
}

export function useBillPayment(id: string) {
  return useQuery({
    queryKey: queryKeys.billPayments.detail(id),
    queryFn: () => getBillPaymentByIdAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60,
  });
}

export function useBillPaymentsSummary(
  filters: BillPaymentFilters,
  search: string,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.billPayments.all,
      "summary",
      filters,
      search,
    ] as const,
    queryFn: () => getBillPaymentsSummaryAction(filters, search),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60,
  });
}

/**
 * Drives the global "Record supplier payment" picker on /bill-payments.
 * Short stale time so newly-completed bills appear without forcing a refresh.
 */
export function useOpenBillsForPayment(search: string, enabled = true) {
  return useQuery({
    queryKey: [
      ...queryKeys.billPayments.all,
      "open-bills",
      search,
    ] as const,
    queryFn: () => getOpenBillsForPaymentAction({ search }),
    enabled,
    placeholderData: previousData => previousData,
    staleTime: 1000 * 15,
  });
}
