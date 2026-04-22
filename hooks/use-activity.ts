"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getActivityForSalesOrderAction,
  getActivityForSupplierInvoiceAction,
} from "@/actions/audit";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useSalesOrderActivity(orderId: string) {
  return useQuery({
    queryKey: queryKeys.salesOrders.activity(orderId),
    queryFn: () => getActivityForSalesOrderAction(orderId),
    enabled: !!orderId && isUuid(orderId),
    staleTime: 1000 * 30,
  });
}

export function useSupplierInvoiceActivity(supplierInvoiceId: string) {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.activity(supplierInvoiceId),
    queryFn: () => getActivityForSupplierInvoiceAction(supplierInvoiceId),
    enabled: !!supplierInvoiceId && isUuid(supplierInvoiceId),
    staleTime: 1000 * 30,
  });
}
