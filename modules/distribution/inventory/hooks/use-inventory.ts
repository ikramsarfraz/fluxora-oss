"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adjustInventoryItemAction,
  bulkAdjustLotInventoryAction,
  getFifoAllocationForProductAction,
  getInventoryItemByIdAction,
  getInventoryItemsAction,
  getInventoryItemsPageAction,
  getInventoryProductSummaryAction,
  getProductCasesOnHandAction,
} from "@/modules/distribution/inventory/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { InventoryListParams } from "@/modules/distribution/inventory/services/inventory";

export function useInventoryItems() {
  return useQuery({
    queryKey: queryKeys.inventory.all,
    queryFn: getInventoryItemsAction,
    staleTime: 1000 * 60 * 5,
  });
}

export function useInventoryItemsPage(params: InventoryListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.list(params),
    queryFn: () => getInventoryItemsPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(id),
    queryFn: () => getInventoryItemByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdjustInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adjustInventoryItemAction,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.detail(variables.inventoryItemId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      if (result?.lot?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.lots.detail(result.lot.id),
        });
      }
    },
  });
}

export function useProductCasesOnHand() {
  return useQuery({
    queryKey: queryKeys.inventory.casesOnHand,
    queryFn: getProductCasesOnHandAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useInventoryProductSummary() {
  return useQuery({
    queryKey: queryKeys.inventory.productSummary,
    queryFn: getInventoryProductSummaryAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useFifoAllocation(productId: string | null, requestedCases: number) {
  return useQuery({
    queryKey: queryKeys.inventory.fifoAllocation(productId ?? "", requestedCases),
    queryFn: () => getFifoAllocationForProductAction(productId!, requestedCases),
    enabled: !!productId && requestedCases > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export function useBulkAdjustLotInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkAdjustLotInventoryAction,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.lots.detail(variables.lotId),
      });
    },
  });
}
