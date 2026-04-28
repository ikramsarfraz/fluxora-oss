"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orderStatusLabel } from "@/lib/utils/status-labels";

import type { SalesOrderDetail } from "@/services/orders";

import type { OrderActionAvailability } from "./order-action-rules";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  sales_order: "outline",
  confirmed: "secondary",
  fulfilled: "default",
  cancelled: "destructive",
};

export interface OrderHeaderActions {
  onEdit?: () => void;
  onConfirm?: () => void;
  onStartFulfillment?: () => void;
  onGenerateInvoice?: () => void;
  onRecordPayment?: () => void;
  onPrint?: () => void;
  onDuplicate?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

interface OrderHeaderProps {
  order: SalesOrderDetail;
  actionState: OrderActionAvailability;
  actions?: OrderHeaderActions;
  pendingAction?: string | null;
}

function formatRelative(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}

interface PrimaryAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabledReason?: string | null;
}

function getPrimaryAction(
  actionState: OrderActionAvailability,
  actions: OrderHeaderActions,
): PrimaryAction | null {
  switch (actionState.primaryActionKey) {
    case "record-payment":
      return {
        key: "record-payment",
        label: "Record payment",
        icon: Receipt,
        onClick: actionState.canRecordPayment
          ? actions.onRecordPayment
          : undefined,
        disabledReason: actionState.recordPaymentReason,
      };
    case "generate-invoice":
      return {
        key: "generate-invoice",
        label: "Generate invoice",
        icon: FileText,
        onClick: actionState.canGenerateInvoice
          ? actions.onGenerateInvoice
          : undefined,
        disabledReason: actionState.generateInvoiceReason,
      };
    case "start-fulfillment":
      return {
        key: "start-fulfillment",
        label: "Start fulfillment",
        icon: Truck,
        onClick: actionState.canStartFulfillment
          ? actions.onStartFulfillment
          : undefined,
        disabledReason: actionState.startFulfillmentReason,
      };
    case "confirm-order":
      return {
        key: "confirm-order",
        label: "Confirm order",
        icon: CheckCircle2,
        onClick: actionState.canConfirm ? actions.onConfirm : undefined,
        disabledReason: actionState.confirmReason,
      };
    default:
      return null;
  }
}

export function OrderHeader({
  order,
  actionState,
  actions = {},
  pendingAction,
}: OrderHeaderProps) {
  const title = order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
  const primary = getPrimaryAction(actionState, actions);
  const isLocked = !actionState.canEdit;
  const createdRelative = formatRelative(order.createdAt);
  const updatedRelative = formatRelative(order.updatedAt);
  const createdByName = order.createdBy?.fullName ?? null;
  const updatedByName = order.updatedBy?.fullName ?? null;
  const helperText =
    (primary && !primary.onClick ? primary.disabledReason : null) ??
    (!actionState.canEdit ? actionState.editReason : null);
  const latestInvoice = (order.invoices ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.invoiceDate ?? b.createdAt).getTime() -
        new Date(a.invoiceDate ?? a.createdAt).getTime(),
    )[0];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
            {orderStatusLabel(order.status)}
          </Badge>
          {order.customer && (
            <>
              <span className="text-muted-foreground">·</span>
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-base font-medium hover:underline"
              >
                {order.customer.name}
              </Link>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          {createdByName && createdRelative && (
            <span>
              Created by{" "}
              <span className="text-foreground">{createdByName}</span>{" "}
              {createdRelative}
            </span>
          )}
          {updatedRelative && updatedRelative !== createdRelative && (
            <>
              <span>·</span>
              <span>
                {updatedByName ? (
                  <>
                    Updated by{" "}
                    <span className="text-foreground">
                      {updatedByName}
                    </span>{" "}
                  </>
                ) : (
                  "Updated "
                )}
                {updatedRelative}
              </span>
            </>
          )}
          {latestInvoice && (
            <>
              <span>·</span>
              <Link
                href={`/invoices/${latestInvoice.id}`}
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {latestInvoice.invoiceNumber}
              </Link>
              <span>{latestInvoice.status.replaceAll("_", " ")}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {primary && (
            <Button
              type="button"
              onClick={primary.onClick}
              disabled={!primary.onClick || pendingAction === primary.key}
              title={
                !primary.onClick
                  ? (primary.disabledReason ?? undefined)
                  : undefined
              }
            >
              <primary.icon className="mr-2 h-4 w-4" />
              {pendingAction === primary.key ? "Working…" : primary.label}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={actions.onEdit}
            disabled={!actions.onEdit || isLocked}
            title={
              !actions.onEdit || isLocked
                ? (actionState.editReason ?? undefined)
                : undefined
            }
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {actions.onPrint && (
                <DropdownMenuItem onSelect={actions.onPrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </DropdownMenuItem>
              )}
              {actions.onDuplicate && (
                <DropdownMenuItem onSelect={actions.onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {(actions.onPrint || actions.onDuplicate) &&
                (actions.onCancel || actions.onDelete) && (
                  <DropdownMenuSeparator />
                )}
              {actions.onCancel && order.status !== "cancelled" && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={actionState.canCancel ? actions.onCancel : undefined}
                  disabled={!actionState.canCancel}
                  title={
                    !actionState.canCancel
                      ? (actionState.cancelReason ?? undefined)
                      : undefined
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel order
                </DropdownMenuItem>
              )}
              {actions.onDelete && !actionState.hasInvoice && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={actions.onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete order
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {helperText ? (
          <p className="max-w-xs text-right text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
