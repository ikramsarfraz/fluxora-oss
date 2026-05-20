"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  getOpenInvoicesForPaymentAction,
  getSalesInvoiceByIdAction,
  getSalesInvoicesAction,
  getSalesInvoicesPageAction,
  getSalesInvoicesSummaryAction,
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
