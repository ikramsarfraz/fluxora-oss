"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  getSalesInvoiceByIdAction,
  getSalesInvoicesAction,
  getSalesInvoicesPageAction,
} from "@/modules/distribution/invoices/actions";
import { isUuid } from "@/lib/utils/uuid";
import type { SalesInvoiceListParams } from "@/modules/distribution/invoices/services/invoicing";

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
