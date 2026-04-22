"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  useDeleteSalesOrder,
  useGenerateInvoiceForSalesOrder,
  useSalesOrder,
  useUpdateSalesOrderStatus,
} from "@/hooks/use-orders";
import { DetailSection } from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

import { OrderActivityTimeline } from "./order-activity-timeline";
import { OrderAttachmentsCard } from "./order-attachments-card";
import { OrderDetailsCard } from "./order-details-card";
import { OrderFinancialSummary } from "./order-financial-summary";
import { OrderFulfillmentSection } from "./order-fulfillment-section";
import { OrderHeader } from "./order-header";
import { OrderLinesTable } from "./order-lines-table";
import { OrderFulfillmentEntryModal } from "./order-fulfillment-entry-modal";
import { OrderPaymentEntryDialog } from "./order-payment-entry-dialog";
import { OrderWorkflowSummary } from "./order-workflow-summary";
import { getOrderActionAvailability } from "./order-action-rules";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const {
    data: order,
    isLoading,
    isError,
    error: loadError,
  } = useSalesOrder(orderId);

  const deleteOrder = useDeleteSalesOrder();
  const generateInvoice = useGenerateInvoiceForSalesOrder();
  const updateOrderStatus = useUpdateSalesOrderStatus();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [fulfillmentDialogOpen, setFulfillmentDialogOpen] = useState(false);

  const title = order?.orderNumber ?? (order ? order.id.slice(0, 8) : "");
  useSetBreadcrumbLabel(`/orders/${orderId}`, title || undefined);

  if (isLoading) return <PageLoading message="Loading order..." />;
  if (isError || !order)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Order not found."}
      />
    );

  const actionState = getOrderActionAvailability(order);
  const lines = order.lines ?? [];
  const { hasInvoice, isPaid, readyToInvoice } = actionState;

  const handleGenerateInvoice =
    !hasInvoice && readyToInvoice
      ? () => {
          generateInvoice.mutate(
            { salesOrderId: order.id },
            {
              onSuccess: invoice => {
                toast.success(
                  `Invoice ${invoice?.invoiceNumber ?? ""} generated.`,
                );
              },
              onError: error => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not generate invoice.",
                );
              },
            },
          );
        }
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <OrderHeader
        order={order}
        actionState={actionState}
        pendingAction={
          generateInvoice.isPending
            ? "generate-invoice"
            : updateOrderStatus.isPending
              ? "confirm-order"
              : null
        }
        actions={{
          onGenerateInvoice: handleGenerateInvoice,
          onRecordPayment: actionState.canRecordPayment
            ? () => setPaymentDialogOpen(true)
            : undefined,
          onStartFulfillment: actionState.canStartFulfillment
            ? () => setFulfillmentDialogOpen(true)
            : undefined,
          onConfirm: actionState.canConfirm
            ? () => {
                updateOrderStatus.mutate(
                  { id: order.id, status: "confirmed" },
                  {
                    onSuccess: () => {
                      toast.success("Order confirmed.");
                    },
                    onError: error => {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not confirm order.",
                      );
                    },
                  },
                );
              }
            : undefined,
          onEdit: actionState.canEdit
            ? () => router.push(`/orders/${order.id}/edit`)
            : undefined,
          onDelete: hasInvoice ? undefined : () => setDeleteOpen(true),
        }}
      />
      <OrderWorkflowSummary
        order={order}
        hasInvoice={hasInvoice}
        isPaid={isPaid}
        readyToInvoice={readyToInvoice}
      />

      <OrderDetailsCard order={order} />

      <DetailSection
        title="Line items"
        description={
          lines.length
            ? `${lines.length} line item${lines.length === 1 ? "" : "s"}. Expand a row to review fulfillment captures, case-level detail, and inventory allocations.`
            : "No line items on this order."
        }
      >
        <OrderLinesTable lines={lines} />
      </DetailSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <DetailSection
          title="Fulfillment"
          description="Warehouse progress, captured weight, and box allocations."
        >
          <OrderFulfillmentSection order={order} />
        </DetailSection>

        <DetailSection
          title="Financial summary"
          description={
            hasInvoice
              ? "Invoiced totals, payment state, and remaining receivables."
              : "Estimated totals based on current line items and customer settings."
          }
        >
          <OrderFinancialSummary
            order={order}
            onGenerateInvoice={handleGenerateInvoice}
            onRecordPayment={
              actionState.canRecordPayment ? () => setPaymentDialogOpen(true) : undefined
            }
            canGenerateInvoice={
              !hasInvoice && readyToInvoice && !generateInvoice.isPending
            }
            readyToInvoice={readyToInvoice}
          />
        </DetailSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <OrderAttachmentsCard order={order} />

        <DetailSection
          title="Activity / audit"
          description="Everything that has happened on this order, its line items, invoices, and payments."
        >
          <OrderActivityTimeline orderId={orderId} />
        </DetailSection>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{title}</strong> and release
              any allocated inventory back to stock. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => {
                deleteOrder.mutate(orderId, {
                  onSuccess: () => router.push("/orders"),
                });
              }}
            >
              {deleteOrder.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderPaymentEntryDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        order={order}
      />
      <OrderFulfillmentEntryModal
        open={fulfillmentDialogOpen}
        onOpenChange={setFulfillmentDialogOpen}
        order={order}
      />
    </div>
  );
}
