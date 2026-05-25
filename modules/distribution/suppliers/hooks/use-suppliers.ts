"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSupplierAction,
  deleteSupplierAction,
  getSupplierByIdAction,
  getInvoicesForSupplierPageAction,
  getSupplierLotsPageAction,
  getSupplierPortfolioAction,
  getSuppliersAction,
  getSuppliersPageAction,
  updateSupplierAction,
} from "@/modules/distribution/suppliers/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type {
  SupplierInvoicesParams,
  SupplierListParams,
  SupplierLotsParams,
} from "@/modules/distribution/suppliers/services/suppliers";

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
      // The detail page renders supplier name, payment terms, and the new
      // contact/address fields via the portfolio query — invalidating only
      // `detail` left the detail page showing stale values after redirect.
      queryClient.invalidateQueries({
        queryKey: queryKeys.suppliers.portfolio(variables.id),
      });
      // AP aging depends on supplier payment terms.
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.apAging,
      });
    },
  });
}

export function useSupplierPortfolio(id: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.portfolio(id),
    queryFn: () => getSupplierPortfolioAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplierInvoicesPage(id: string, params: SupplierInvoicesParams) {
  return useQuery({
    queryKey: queryKeys.suppliers.invoicesPage(id, params),
    queryFn: () => getInvoicesForSupplierPageAction(id, params),
    enabled: isUuid(id),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplierLotsPage(id: string, params: SupplierLotsParams) {
  return useQuery({
    queryKey: queryKeys.suppliers.lotsPage(id, params),
    queryFn: () => getSupplierLotsPageAction(id, params),
    enabled: isUuid(id),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}
