"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelSalesOrderAction,
  createSalesOrderAction,
  deleteSalesOrderAction,
  findOpenDraftForCustomerAction,
  generateInvoiceForSalesOrderAction,
  getSalesOrderByIdAction,
  getSalesOrdersPageAction,
  markSalesOrderLineShortShippedAction,
  removeSalesOrderAttachmentAction,
  recordPaymentForSalesOrderInvoiceAction,
  recordSalesOrderFulfillmentAction,
  reverseSalesOrderFulfillmentAction,
  uploadSalesOrderAttachmentAction,
  updateSalesOrderStatusAction,
  updateSalesOrderAction,
  updateSalesOrderNotesAction,
} from "@/modules/distribution/orders/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { SalesOrderListParams } from "@/modules/distribution/orders/services/orders";

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

/**
 * Most-recent open (status: "sales_order") draft for a customer, or
 * `null` if none. Used by the new-order form to surface a "resume
 * existing draft" affordance when the user picks a customer that
 * already has one — keeps the autosave from creating accidental
 * duplicate drafts when a tab is closed and reopened.
 */
export function useOpenDraftForCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ["sales-orders", "open-draft-for-customer", customerId] as const,
    queryFn: () =>
      customerId ? findOpenDraftForCustomerAction(customerId) : null,
    enabled: !!customerId && isUuid(customerId),
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

  // Structural shape of the cached invoice fields we mutate optimistically.
  // Avoids dragging the full SalesInvoiceWithRelations type across the
  // orders/invoices module boundary just for this update — anything missing
  // gets restored from the server via the onSettled invalidation.
  type InvoiceBalanceFields = {
    amountPaid: string;
    balanceDue: string;
    totalAmount: string;
    status: string;
  };

  return useMutation({
    mutationFn: recordPaymentForSalesOrderInvoiceAction,
    onMutate: async variables => {
      const invoiceKey = queryKeys.invoices.detail(variables.salesInvoiceId);
      // Cancel any in-flight refetches so they can't overwrite our patch.
      await queryClient.cancelQueries({ queryKey: invoiceKey });

      const previousInvoice = queryClient.getQueryData<InvoiceBalanceFields>(invoiceKey);
      if (!previousInvoice) return { invoiceKey, previousInvoice: null };

      const paymentAmount = Number(variables.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return { invoiceKey, previousInvoice: null };
      }

      const newAmountPaid =
        Number(previousInvoice.amountPaid) + paymentAmount;
      const totalAmount = Number(previousInvoice.totalAmount);
      const newBalanceDue = Math.max(totalAmount - newAmountPaid, 0);
      const newStatus =
        newAmountPaid >= totalAmount
          ? "paid"
          : newAmountPaid > 0
            ? "partially_paid"
            : previousInvoice.status;

      queryClient.setQueryData<InvoiceBalanceFields>(invoiceKey, prev =>
        prev
          ? {
              ...prev,
              amountPaid: newAmountPaid.toFixed(2),
              balanceDue: newBalanceDue.toFixed(2),
              status: newStatus,
            }
          : prev,
      );

      return { invoiceKey, previousInvoice };
    },
    onError: (_err, _variables, context) => {
      // Roll back so the user sees the real (un-paid) balance after the
      // toast surfaces the failure.
      if (context?.invoiceKey && context.previousInvoice) {
        queryClient.setQueryData(context.invoiceKey, context.previousInvoice);
      }
    },
    onSuccess: (_, variables) => {
      // Sales order surfaces (existing): order detail (totals + payment
      // status), activity feed, listing.
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(variables.salesOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.activity(variables.salesOrderId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });

      // Invoice surfaces: the targeted invoice's totals (Paid / Balance due /
      // status pill) and its embedded payments relation, plus the listing
      // page so the row's status updates without a reload.
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(variables.salesInvoiceId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });

      // Payments surfaces: the new event flips both the listing and any
      // future detail queries.
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });

      // Dashboard AR aging buckets and the dashboard summary refresh.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.arAging });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary,
      });

      // Customer-side caches (portfolio, detail, credit snapshot used
      // on the new-order customer chip) all carry the post-payment
      // balance; broad-invalidate by prefix.
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}
