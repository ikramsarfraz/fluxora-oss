"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addInventoryAllocationToSalesOrderLineAction,
  cancelSalesOrderAction,
  createSalesOrderAction,
  deleteSalesOrderAction,
  generateInvoiceForSalesOrderAction,
  getSalesOrderLineAllocationEditorAction,
  getSalesOrderByIdAction,
  getSalesOrdersAction,
  getSalesOrdersPageAction,
  markSalesOrderLineShortShippedAction,
  removeSalesOrderLineAllocationAction,
  removeSalesOrderAttachmentAction,
  recordPaymentForSalesOrderInvoiceAction,
  recordSalesOrderFulfillmentAction,
  reverseSalesOrderFulfillmentAction,
  uploadSalesOrderAttachmentAction,
  updateSalesOrderStatusAction,
  updateSalesOrderAction,
  updateSalesOrderNotesAction,
} from "@/actions/orders";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { SalesOrderListParams } from "@/services/orders";

export function useSalesOrders() {
  return useQuery({
    queryKey: queryKeys.salesOrders.all,
    queryFn: getSalesOrdersAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSalesOrdersPage(params: SalesOrderListParams) {
  return useQuery({
    queryKey: queryKeys.salesOrders.list(params),
    queryFn: () => getSalesOrdersPageAction(params),
    placeholderData: previousData => previousData,
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

export function useSalesOrderLineAllocationEditor(
  orderId: string,
  lineId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.salesOrders.allocationEditor(orderId, lineId),
    queryFn: () =>
      getSalesOrderLineAllocationEditorAction({
        salesOrderId: orderId,
        salesOrderLineId: lineId,
      }),
    enabled: enabled && !!orderId && !!lineId && isUuid(orderId) && isUuid(lineId),
    staleTime: 1000 * 30,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesOrderAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
      invalidateSetupChecklistQuery(queryClient);
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

export function useUpdateSalesOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrderStatusAction,
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

export function useCancelSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSalesOrderAction,
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

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrderAction,
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

export function useRecordSalesOrderFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordSalesOrderFulfillmentAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useMarkSalesOrderLineShortShipped() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markSalesOrderLineShortShippedAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useReverseSalesOrderFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reverseSalesOrderFulfillmentAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useAddInventoryAllocationToSalesOrderLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addInventoryAllocationToSalesOrderLineAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.allocationEditor(
          variables.salesOrderId,
          variables.salesOrderLineId,
        ),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useRemoveSalesOrderLineAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeSalesOrderLineAllocationAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.allocationEditor(
          variables.salesOrderId,
          variables.salesOrderLineId,
        ),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useGenerateInvoiceForSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateInvoiceForSalesOrderAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}

export function useUploadSalesOrderAttachment(salesOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("salesOrderId", salesOrderId);
      form.append("file", file);
      return uploadSalesOrderAttachmentAction(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(salesOrderId),
      });
    },
  });
}

export function useRemoveSalesOrderAttachment(salesOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      removeSalesOrderAttachmentAction({ salesOrderId, fileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(salesOrderId),
      });
    },
  });
}

export function useRecordPaymentForSalesOrderInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordPaymentForSalesOrderInvoiceAction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },
  });
}
