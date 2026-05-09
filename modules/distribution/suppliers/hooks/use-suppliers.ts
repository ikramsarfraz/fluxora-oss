"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSupplierAction,
  deleteSupplierAction,
  getSupplierByIdAction,
  getSuppliersAction,
  getSuppliersPageAction,
  updateSupplierAction,
} from "@/actions/suppliers";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { SupplierListParams } from "@/modules/distribution/suppliers/services/suppliers";

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: getSuppliersAction,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSuppliersPage(params: SupplierListParams) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(params),
    queryFn: () => getSuppliersPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: () => getSupplierByIdAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplierAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplierAction,
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
      if (result?.id) {
        queryClient.setQueryData(
          queryKeys.suppliers.detail(result.id),
          result,
        );
      }
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSupplierAction,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.suppliers.detail(variables.id),
      });
      // AP aging depends on supplier payment terms.
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.apAging,
      });
    },
  });
}
