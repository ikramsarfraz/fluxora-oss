"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getActivityForInventoryItemAction,
  getActivityForSalesOrderAction,
  getActivityForSupplierInvoiceAction,
} from "@/modules/distribution/actions";
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

export function useInventoryItemActivity(inventoryItemId: string) {
  return useQuery({
    queryKey: queryKeys.inventory.activity(inventoryItemId),
    queryFn: () => getActivityForInventoryItemAction(inventoryItemId),
    enabled: !!inventoryItemId && isUuid(inventoryItemId),
    staleTime: 1000 * 30,
  });
}
