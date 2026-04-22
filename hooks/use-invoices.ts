"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  getSalesInvoiceByIdAction,
  getSalesInvoicesAction,
} from "@/actions/invoices";
import { isUuid } from "@/lib/utils/uuid";

export function useSalesInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.all,
    queryFn: () => getSalesInvoicesAction(),
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
