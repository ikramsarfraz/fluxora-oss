"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, XCircle } from "lucide-react";

import {
  useCancelSalesOrder,
  useDeleteSalesOrder,
  useGenerateInvoiceForSalesOrder,
  useSalesOrder,
  useUpdateSalesOrderStatus,
} from "../hooks/use-orders";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/listing-page";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { formatDisplayDate } from "@/lib/utils/date";

import { OrderPaymentEntryDialog } from "./order-payment-entry-dialog";
import { getOrderActionAvailability } from "./order-action-rules";
import { OrderItemsCard } from "./order-items-card";
import { OrderActivityCard } from "./order-activity-card";
import { OrderNotesAttachmentsCard } from "./order-notes-attachments-card";
import { OrderSidebar } from "./order-sidebar";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  accent: "var(--color-forest-mid)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ── State pill derivation ──────────────────────────────────────────────────

interface PillConfig {
  label: string;
  bg: string;
  color: string;
}

function getStatePill(
  status: string,
  isPaid: boolean,
  readyToInvoice: boolean,
): PillConfig {
  if (status === "cancelled")
    return { label: "Cancelled", bg: C.warnSoft, color: C.warn };
  if (isPaid)
    return { label: "Fulfilled & paid", bg: C.goodSoft, color: C.good };
  if (status === "fulfilled")
    return {
      label: readyToInvoice ? "Ready to invoice" : "Fulfilled",
      bg: C.goodSoft,
      color: C.good,
    };
  if (status === "confirmed")
    return { label: "Awaiting fulfillment", bg: C.infoSoft, color: C.info };
  // sales_order / draft
  return { label: "Draft", bg: C.line2, color: C.muted };
}

// ── Component ──────────────────────────────────────────────────────────────

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: order, isLoading, isError, error: loadError } = useSalesOrder(orderId);
  const { data: currentUser } = useCurrentPortalUser();

  const deleteOrder = useDeleteSalesOrder();
  const cancelOrder = useCancelSalesOrder();
  const generateInvoice = useGenerateInvoiceForSalesOrder();
  const updateOrderStatus = useUpdateSalesOrderStatus();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [fulfillDrawerOpen, setFulfillDrawerOpen] = useState(false);

  const title = order?.orderNumber ?? (order ? order.id.slice(0, 8) : "");
  useSetBreadcrumbLabel(`/orders/${orderId}`, title || undefined);

  if (isLoading) return <DetailPageSkeleton includeTable />;
  if (isError || !order)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Order not found."}
      />
    );

  const actionState = getOrderActionAvailability(order, currentUser?.role);
  const { hasInvoice, isPaid, readyToInvoice } = actionState;

  const orderTitle = order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
  const pill = getStatePill(order.status, isPaid, readyToInvoice);

  const latestInvoice = (order.invoices ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.invoiceDate ?? b.createdAt).getTime() -
        new Date(a.invoiceDate ?? a.createdAt).getTime(),
    )[0];

  function handleGenerateInvoice() {
    generateInvoice.mutate(
      { salesOrderId: order!.id },
      {
        onSuccess: inv => toast.success(`Invoice ${inv?.invoiceNumber ?? ""} generated.`),
        onError: err =>
          toast.error(err instanceof Error ? err.message : "Could not generate invoice."),
      },
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Geist', system-ui, sans-serif",
        color: C.ink,
        lineHeight: "1.5",
      }}
    >
      {/* ── PAGE HEADER ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "24px",
          alignItems: "start",
          paddingBottom: "22px",
          borderBottom: `1px solid ${C.line}`,
          marginBottom: "24px",
        }}
      >
        {/* Left: identity */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontFamily: C.mono,
                fontSize: "26px",
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: C.ink,
                margin: 0,
              }}
            >
              {orderTitle}
            </h1>
            <StatusPill label={pill.label} bg={pill.bg} color={pill.color} />
          </div>

          {order.customer && (
            <div style={{ fontSize: "16px", color: C.ink2, marginTop: "4px" }}>
              {order.customer.name}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "18px",
              marginTop: "14px",
              color: C.muted,
              fontSize: "13px",
              flexWrap: "wrap",
            }}
          >
            {order.orderDate && (
              <span>
                <b style={{ color: C.ink2, fontWeight: 500 }}>Ordered</b>{" "}
                {formatDisplayDate(order.orderDate)}
              </span>
            )}
            {order.dueDate && (
              <span>
                <b style={{ color: C.ink2, fontWeight: 500 }}>Due</b>{" "}
                {formatDisplayDate(order.dueDate)}
              </span>
            )}
            {latestInvoice && (
              <span>
                <b style={{ color: C.ink2, fontWeight: 500 }}>Invoice</b>{" "}
                <a
                  href={`/invoices/${latestInvoice.id}`}
                  style={{
                    color: C.accent,
                    textDecoration: "none",
                    fontFamily: C.mono,
                  }}
                >
                  {latestInvoice.invoiceNumber}
                </a>
              </span>
            )}
            {order.createdBy?.fullName && (
              <span>by {order.createdBy.fullName}</span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          {/* Primary workflow action */}
          {actionState.canStartFulfillment && (
            <PrimaryBtn onClick={() => setFulfillDrawerOpen(true)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M2 4h11l-1 7H3L2 4Z" />
                <path d="M6 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
              </svg>
              Fulfill order
            </PrimaryBtn>
          )}
          {readyToInvoice && !hasInvoice && actionState.canGenerateInvoice && (
            <PrimaryBtn
              onClick={handleGenerateInvoice}
              disabled={generateInvoice.isPending}
            >
              {generateInvoice.isPending ? "Generating…" : "Generate invoice"}
            </PrimaryBtn>
          )}
          {hasInvoice && actionState.canRecordPayment && (
            <PrimaryBtn onClick={() => setPaymentDialogOpen(true)}>
              Record payment
            </PrimaryBtn>
          )}
          {actionState.canConfirm && (
            <PrimaryBtn
              onClick={() =>
                updateOrderStatus.mutate(
                  { id: order.id, status: "confirmed" },
                  {
                    onSuccess: () => toast.success("Order confirmed."),
                    onError: err =>
                      toast.error(
                        err instanceof Error ? err.message : "Could not confirm order.",
                      ),
                  },
                )
              }
              disabled={updateOrderStatus.isPending}
            >
              {updateOrderStatus.isPending ? "Confirming…" : "Confirm order"}
            </PrimaryBtn>
          )}

          {/* Edit button */}
          {actionState.canEdit && (
            <SecondaryBtn onClick={() => router.push(`/orders/${order.id}/edit`)}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M11 2l3 3-8 8-4 1 1-4 8-8Z" />
              </svg>
              Edit
            </SecondaryBtn>
          )}

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-[30px] border-border-default bg-card text-ink-warm shadow-none hover:bg-divider"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {order.status !== "cancelled" && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={actionState.canCancel ? () => setCancelOpen(true) : undefined}
                  disabled={!actionState.canCancel}
                  title={!actionState.canCancel ? (actionState.cancelReason ?? undefined) : undefined}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel order
                </DropdownMenuItem>
              )}
              {!hasInvoice && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete order
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── BODY GRID ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          <OrderItemsCard
            order={order}
            actionState={actionState}
            fulfillDrawerOpen={fulfillDrawerOpen}
            onOpenFulfillDrawer={() => setFulfillDrawerOpen(true)}
            onCloseFulfillDrawer={() => setFulfillDrawerOpen(false)}
          />
          <OrderActivityCard orderId={orderId} />
          <OrderNotesAttachmentsCard order={order} />
        </div>

        {/* Right sidebar */}
        <OrderSidebar
          order={order}
          actionState={actionState}
          fulfillDrawerOpen={fulfillDrawerOpen}
          onOpenFulfillDrawer={() => setFulfillDrawerOpen(true)}
        />
      </div>

      {/* ── DIALOGS ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{title}</strong> and release any allocated
              inventory back to stock. This cannot be undone.
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
                  onError: err =>
                    toast.error(
                      err instanceof Error ? err.message : "Could not delete order.",
                    ),
                });
              }}
            >
              {deleteOrder.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{title}</strong> as cancelled and release any allocated
              inventory. The order history stays visible for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOrder.isPending}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelOrder.isPending}
              onClick={event => {
                event.preventDefault();
                cancelOrder.mutate(
                  { id: order.id },
                  {
                    onSuccess: () => {
                      toast.success("Order cancelled.");
                      setCancelOpen(false);
                    },
                    onError: err =>
                      toast.error(
                        err instanceof Error ? err.message : "Could not cancel order.",
                      ),
                  },
                );
              }}
            >
              {cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderPaymentEntryDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        order={order}
      />
    </div>
  );
}

// ── Button primitives ──────────────────────────────────────────────────────

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-8 border-forest-mid bg-forest-mid px-3.5 text-[13px] text-card-warm hover:bg-forest disabled:opacity-50"
    >
      {children}
    </Button>
  );
}

function SecondaryBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider"
    >
      {children}
    </Button>
  );
}
