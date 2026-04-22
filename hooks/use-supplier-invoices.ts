"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeSupplierInvoiceAction,
  createSupplierInvoiceAction,
  deleteSupplierInvoiceAction,
  getSupplierInvoiceByIdAction,
  getSupplierInvoicesAction,
  reverseSupplierInvoiceAction,
  updateSupplierInvoiceAction,
} from "@/actions/supplier-invoices";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useSupplierInvoices() {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.all,
    queryFn: () => getSupplierInvoicesAction(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplierInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.detail(id),
    queryFn: () => getSupplierInvoiceByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.supplierInvoices.all });
  // Side effects of completion touch lots + inventory caches.
  queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
  queryClient.invalidateQueries({ queryKey: ["inventory"] });
}

export function useCreateSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplierInvoiceAction,
    onSuccess: result => {
      invalidateAll(queryClient);
      if (result?.id) {
        queryClient.setQueryData(
          queryKeys.supplierInvoices.detail(result.id),
          result,
        );
      }
    },
  });
}

export function useUpdateSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSupplierInvoiceAction,
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(variables.id),
      });
    },
  });
}

export function useCompleteSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeSupplierInvoiceAction,
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(variables.id),
      });
    },
  });
}

export function useReverseSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reverseSupplierInvoiceAction,
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(variables.id),
      });
    },
  });
}

export function useDeleteSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplierInvoiceAction,
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}
