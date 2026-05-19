"use client";

import { type ComponentType } from "react";
import { CheckCircle2, CircleDashed, FileText, Wallet } from "lucide-react";

import { DetailSection } from "@/components/detail-section";
import { Badge } from "@/components/ui/badge";

import type { SalesOrderDetail } from "../services/orders";

import { OrderPipeline } from "./order-pipeline";
import {
  getLineAllocationReconciliation,
  getOrderFulfillmentSummary,
} from "./order-fulfillment-utils";

interface OrderWorkflowSummaryProps {
  order: SalesOrderDetail;
  hasInvoice: boolean;
  isPaid: boolean;
  readyToInvoice?: boolean;
}

export function OrderWorkflowSummary({
  order,
  hasInvoice,
  isPaid,
  readyToInvoice = false,
}: OrderWorkflowSummaryProps) {
  const fulfillment = getOrderFulfillmentSummary(order.lines ?? []);
  const unreconciledLines = (order.lines ?? []).filter(
    line => !getLineAllocationReconciliation(line).reconciled,
  ).length;
  const totalInvoiceBalance = (order.invoices ?? []).reduce(
    (sum, invoice) => sum + (parseFloat(invoice.balanceDue ?? "0") || 0),
    0,
  );
  const totalInvoiceAmount = (order.invoices ?? []).reduce(
    (sum, invoice) => sum + (parseFloat(invoice.totalAmount ?? "0") || 0),
    0,
  );
  const financialStatus = !hasInvoice
    ? "not_invoiced"
    : isPaid
      ? "paid"
      : totalInvoiceBalance < totalInvoiceAmount
        ? "partially_paid"
        : "invoiced";

  const fulfillmentStatus =
    order.status === "cancelled"
      ? "Cancelled"
      : fulfillment.status.replaceAll("_", " ");

  return (
    <DetailSection
      title="Header / summary"
      description="Operational status across order entry, fulfillment, invoicing, and payment."
    >
      <div className="flex flex-col gap-5">
        <OrderPipeline
          status={order.status}
          hasInvoice={hasInvoice}
          isPaid={isPaid}
          readyToInvoice={readyToInvoice}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <WorkflowStat
            icon={CircleDashed}
            label="Order"
            value={order.status === "sales_order" ? "Draft" : order.status}
            accent={order.status === "cancelled" ? "destructive" : "outline"}
          />
          <WorkflowStat
            icon={CheckCircle2}
            label="Fulfillment status"
            value={fulfillmentStatus}
            accent={
              fulfillment.status === "fulfilled"
                ? "default"
                : fulfillment.status === "short_shipped"
                  ? "secondary"
                : fulfillment.status === "partial"
                  ? "secondary"
                  : "outline"
            }
          />
          <WorkflowStat
            icon={FileText}
            label="Financial status"
            value={financialStatus}
            accent={
              financialStatus === "paid"
                ? "default"
                : financialStatus === "partially_paid"
                  ? "secondary"
                  : hasInvoice
                    ? "secondary"
                    : "outline"
            }
          />
          <WorkflowStat
            icon={Wallet}
            label="Payment status"
            value={
              !hasInvoice
                ? "unpaid"
                : isPaid
                  ? "paid"
                  : totalInvoiceBalance < totalInvoiceAmount
                    ? "partial"
                    : "unpaid"
            }
            accent={isPaid ? "default" : hasInvoice ? "secondary" : "outline"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <WorkflowStat
            icon={CircleDashed}
            label="Expected quantity"
            value={String(fulfillment.expectedQuantity)}
            accent="outline"
          />
          <WorkflowStat
            icon={CheckCircle2}
            label="Fulfilled quantity"
            value={String(fulfillment.fulfilledQuantity)}
            accent={
              fulfillment.fulfilledQuantity > 0 ? "secondary" : "outline"
            }
          />
          <WorkflowStat
            icon={CircleDashed}
            label="Remaining quantity"
            value={String(fulfillment.remainingQuantity)}
            accent={
              fulfillment.remainingQuantity > 0 ? "secondary" : "outline"
            }
          />
          <WorkflowStat
            icon={CircleDashed}
            label="Short-shipped lines"
            value={String(fulfillment.shortShippedLines)}
            accent="outline"
          />
        </div>

        {readyToInvoice && !hasInvoice ? (
          <div className="rounded-lg border border-success-border bg-success-bg/60 px-4 py-3 text-sm text-success-fg dark:border-emerald-900/40 dark:bg-success-fg/20 dark:text-success-fg">
            Ready for invoicing. All lines are closed by fulfillment or short shipment.
          </div>
        ) : null}

        {unreconciledLines > 0 ? (
          <div className="rounded-lg border border-warning-border bg-warning-bg/60 px-4 py-3 text-sm text-warning-fg dark:border-amber-900/40 dark:bg-warning-fg/20 dark:text-warning-fg">
            {unreconciledLines} line
            {unreconciledLines === 1 ? "" : "s"} still have allocation warnings.
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}

function WorkflowStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <Badge variant={accent} className="capitalize">
        {value.replaceAll("_", " ")}
      </Badge>
    </div>
  );
}
