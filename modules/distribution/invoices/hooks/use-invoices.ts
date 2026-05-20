"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  getOpenInvoicesForCustomerAction,
  getOpenInvoicesForPaymentAction,
  getSalesInvoiceByIdAction,
  getSalesInvoicesAction,
  getSalesInvoicesPageAction,
  getSalesInvoicesSummaryAction,
  recordBulkPaymentForCustomerAction,
} from "@/modules/distribution/invoices/actions";
import { isUuid } from "@/lib/utils/uuid";
import type {
  SalesInvoiceFilters,
  SalesInvoiceListParams,
} from "@/modules/distribution/invoices/services/invoicing";

export function useSalesInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.all,
    queryFn: () => getSalesInvoicesAction(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalesInvoicesPage(params: SalesInvoiceListParams) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => getSalesInvoicesPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalesInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => getSalesInvoiceByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalesInvoicesSummary(
  filters: SalesInvoiceFilters,
  search: string,
) {
  return useQuery({
    queryKey: [...queryKeys.invoices.all, "summary", filters, search] as const,
    queryFn: () => getSalesInvoicesSummaryAction(filters, search),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60,
  });
}

/**
 * Drives the global "Record payment" picker on /payments. Short stale
 * time so the list reflects new invoices and partial-payment balance
 * changes quickly without abusing the server.
 */
export function useOpenInvoicesForPayment(search: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.invoices.all, "open-for-payment", search] as const,
    queryFn: () => getOpenInvoicesForPaymentAction({ search }),
    enabled,
    placeholderData: previousData => previousData,
    staleTime: 1000 * 15,
  });
}

/**
 * Drives the bulk-allocate dialog launched from the customer detail
 * page. Returns this customer's open invoices, oldest-first so the
 * FIFO auto-allocate fills against the oldest balances.
 */
export function useOpenInvoicesForCustomer(customerId: string, enabled = true) {
  return useQuery({
    queryKey: [
      ...queryKeys.customers.detail(customerId),
      "open-invoices",
    ] as const,
    queryFn: () => getOpenInvoicesForCustomerAction(customerId),
    enabled: enabled && isUuid(customerId),
    staleTime: 1000 * 15,
  });
}

export function useRecordBulkPaymentForCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordBulkPaymentForCustomerAction,
    onSuccess: (_result, variables) => {
      // Bulk payment mutates N invoices + writes N payment rows; everything
      // downstream needs to refresh. Use the same fan-out as the single
      // payment hook plus the customer's portfolio (which aggregates AR).
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.arAging });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.customerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.portfolio(variables.customerId),
      });
    },
  });
}
