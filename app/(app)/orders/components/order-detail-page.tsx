"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useDeleteSalesOrder, useSalesOrder } from "@/hooks/use-orders";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  DetailSection,
  DetailField,
  DetailGrid,
} from "@/components/detail-section";
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
import { OrderFinancialSummary } from "./order-financial-summary";
import { OrderFulfillmentSection } from "./order-fulfillment-section";
import { OrderHeader } from "./order-header";
import { OrderLinesTable } from "./order-lines-table";
import { OrderNotesSection } from "./order-notes-section";
import { OrderPipeline } from "./order-pipeline";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const {
    data: order,
    isLoading,
    isError,
    error: loadError,
  } = useSalesOrder(orderId);

  const deleteOrder = useDeleteSalesOrder();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const title = order?.orderNumber ?? (order ? order.id.slice(0, 8) : "");
  useSetBreadcrumbLabel(`/orders/${orderId}`, title || undefined);

  const invoiceSummary = useMemo(() => {
    const invoices = order?.invoices ?? [];
    const hasInvoice = invoices.length > 0;
    let totalBalance = 0;
    let totalAmount = 0;
    for (const inv of invoices) {
      totalBalance += parseFloat(inv.balanceDue ?? "0") || 0;
      totalAmount += parseFloat(inv.totalAmount ?? "0") || 0;
    }
    const isPaid = hasInvoice && totalAmount > 0 && totalBalance <= 0;
    return { hasInvoice, isPaid };
  }, [order]);

  if (isLoading) return <PageLoading message="Loading order..." />;
  if (isError || !order)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Order not found."}
      />
    );

  const lines = order.lines ?? [];
  const { hasInvoice, isPaid } = invoiceSummary;

  return (
    <div className="flex flex-col gap-6">
      <OrderHeader
        order={order}
        hasInvoice={hasInvoice}
        isPaid={isPaid}
        actions={{
          onDelete: hasInvoice ? undefined : () => setDeleteOpen(true),
        }}
      />
      <OrderPipeline
        status={order.status}
        hasInvoice={hasInvoice}
        isPaid={isPaid}
      />

      <DetailSection
        title="Details"
        description="Order header, customer, and scheduling."
      >
        <DetailGrid>
          <DetailField label="Order #">
            {order.orderNumber ? (
              <span className="font-mono text-sm">{order.orderNumber}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Customer">
            {order.customer ? (
              <Link
                href={`/customers/${order.customer.id}`}
                className="hover:underline"
              >
                {order.customer.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Order date">
            {formatDisplayDate(order.orderDate)}
          </DetailField>
          <DetailField label="Due date">
            {order.dueDate ? (
              formatDisplayDate(order.dueDate)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Fuel surcharge">
            {order.addFuelSurcharge ? "Applied" : "Not applied"}
          </DetailField>
          <DetailField label="Created">
            {formatDisplayDate(order.createdAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Line items"
        description={
          lines.length
            ? `${lines.length} line item${lines.length === 1 ? "" : "s"}. Expand a row to see per-case weights and inventory allocations.`
            : "No line items on this order."
        }
      >
        <OrderLinesTable lines={lines} />
      </DetailSection>

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
            ? "Invoiced totals, payments received, and outstanding balance."
            : "Estimated totals based on current line items and customer settings."
        }
      >
        <OrderFinancialSummary order={order} />
      </DetailSection>

      <DetailSection
        title="Notes"
        description="Customer-facing notes appear on the invoice. Internal notes stay private."
      >
        <OrderNotesSection
          order={order}
          disabled={order.status === "cancelled"}
        />
      </DetailSection>

      <DetailSection
        title="Activity"
        description="Everything that has happened on this order, its line items, invoices, and payments."
      >
        <OrderActivityTimeline orderId={orderId} />
      </DetailSection>

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
    </div>
  );
}
