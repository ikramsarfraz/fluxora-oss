"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSalesOrderAction,
  deleteSalesOrderAction,
  getSalesOrderByIdAction,
  getSalesOrdersAction,
  updateSalesOrderNotesAction,
} from "@/actions/orders";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useSalesOrders() {
  return useQuery({
    queryKey: queryKeys.salesOrders.all,
    queryFn: getSalesOrdersAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => getSalesOrderByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesOrderAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSalesOrderAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useUpdateSalesOrderNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrderNotesAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}
