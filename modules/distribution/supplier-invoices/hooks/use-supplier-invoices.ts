"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { captureClientEvent } from "@/lib/posthog-client";

import {
  completeSupplierInvoiceAction,
  createSupplierInvoiceAction,
  createImportProfileAction,
  deleteSupplierInvoiceAction,
  getReversalPreviewAction,
  getSupplierInvoiceByIdAction,
  getSupplierInvoiceCostDiffContextAction,
  getSupplierInvoicesAction,
  getSupplierInvoicesPageAction,
  bulkImportSupplierInvoicesAction,
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

/**
 * Mutation hook for the bulk-import flow. Wraps the FormData-based action and
 * invalidates listing caches when at least one draft was created so the user
 * sees their new bills in the list without a manual refresh.
 */
export function useBulkImportSupplierInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkImportSupplierInvoicesAction,
    onSuccess: result => {
      if (result.summary.created > 0) {
        invalidateAll(queryClient);
        invalidateSetupChecklistQuery(queryClient);
        captureClientEvent("bulk_import.completed", {
          created: result.summary.created,
          needs_review: result.summary.needsReview,
          errored: result.summary.errored,
        });
      }
    },
  });
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

export function useSupplierCostDiffContext(
  supplierId: string,
  productIds: string[],
) {
  const cleanIds = productIds.filter(Boolean);
  return useQuery({
    queryKey: queryKeys.supplierInvoices.costDiff(supplierId, cleanIds),
    queryFn: () =>
      getSupplierInvoiceCostDiffContextAction({
        supplierId,
        productIds: cleanIds,
      }),
    enabled: !!supplierId && cleanIds.length > 0,
    staleTime: 1000 * 30,
  });
}

export function useReversalPreview(invoiceId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.supplierInvoices.reversalPreview(invoiceId),
    queryFn: () => getReversalPreviewAction(invoiceId),
    enabled: (opts?.enabled ?? true) && !!invoiceId && isUuid(invoiceId),
    staleTime: 0,
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
      captureClientEvent("pdf.uploaded", {
        file_size_kb: Math.round(file.size / 1024),
      });
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
