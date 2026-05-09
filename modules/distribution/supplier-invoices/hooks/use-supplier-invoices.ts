"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeSupplierInvoiceAction,
  createSupplierInvoiceAction,
  createImportProfileAction,
  deleteSupplierInvoiceAction,
  getSupplierInvoiceByIdAction,
  getSupplierInvoicesAction,
  getSupplierInvoicesPageAction,
  parseSupplierInvoicePdfAction,
  recordSupplierInvoicePaymentAction,
  recordManualProductSelectionAction,
  removeSupplierInvoiceAttachmentAction,
  reverseSupplierInvoiceAction,
  saveConfirmedAiAliasAction,
  updateSupplierInvoiceAction,
  uploadSupplierInvoiceAttachmentAction,
} from "@/modules/distribution/supplier-invoices/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { SupplierInvoiceListParams } from "@/modules/distribution/supplier-invoices/services/receiving";

export function useSupplierInvoices() {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.all,
    queryFn: () => getSupplierInvoicesAction(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplierInvoicesPage(params: SupplierInvoiceListParams) {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.list(params),
    queryFn: () => getSupplierInvoicesPageAction(params),
    placeholderData: previousData => previousData,
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
      invalidateSetupChecklistQuery(queryClient);
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(variables.id),
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(variables.id),
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(variables.id),
      });
    },
  });
}

export function useRecordSupplierInvoicePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordSupplierInvoicePaymentAction,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(variables.supplierInvoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(variables.supplierInvoiceId),
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

export function useParseSupplierInvoicePdf() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      return await parseSupplierInvoicePdfAction(formData);
    },
  });
}

export function useUploadSupplierInvoiceAttachment(supplierInvoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.set("supplierInvoiceId", supplierInvoiceId);
      formData.set("file", file);
      return await uploadSupplierInvoiceAttachmentAction(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(supplierInvoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(supplierInvoiceId),
      });
    },
  });
}

export function useUploadSupplierInvoiceAttachmentToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      supplierInvoiceId,
      file,
    }: {
      supplierInvoiceId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.set("supplierInvoiceId", supplierInvoiceId);
      formData.set("file", file);
      return await uploadSupplierInvoiceAttachmentAction(formData);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(variables.supplierInvoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(variables.supplierInvoiceId),
      });
    },
  });
}

export function useSaveConfirmedAiAlias() {
  return useMutation({
    mutationFn: saveConfirmedAiAliasAction,
  });
}

export function useRecordManualProductSelection() {
  return useMutation({
    mutationFn: recordManualProductSelectionAction,
  });
}

export function useCreateImportProfile() {
  return useMutation({
    mutationFn: createImportProfileAction,
  });
}

export function useRemoveSupplierInvoiceAttachment(supplierInvoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      removeSupplierInvoiceAttachmentAction({
        supplierInvoiceId,
        fileId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.detail(supplierInvoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supplierInvoices.activity(supplierInvoiceId),
      });
    },
  });
}
