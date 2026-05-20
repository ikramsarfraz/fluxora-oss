"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  DollarSign,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { queryKeys } from "@/lib/query/keys";
import {
  archiveCustomerAction,
  permanentlyDeleteCustomerAction,
  restoreCustomerAction,
} from "@/modules/distribution/customers/actions";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatPhone } from "@/lib/utils/phone";
import { isUuid } from "@/lib/utils/uuid";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { StatusPill } from "@/components/listing-page";
import { PageError } from "@/components/page-error";
import { PageLoading } from "@/components/page-loading";
import { TablePager } from "@/components/table-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CustomerPriceSection } from "../components/customer-price-section";
import {
  useCustomerInvoicesPage,
  useCustomerOrdersPage,
  useCustomerPortfolio,
} from "../hooks/use-customers";
import { BulkPaymentEntryDialog } from "@/modules/distribution/invoices/components/bulk-payment-entry-dialog";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can } from "@/lib/auth/permissions";

// ── Status config ─────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sales_order: { label: "Draft", bg: "var(--color-divider)", color: "var(--color-subtle)" },
  confirmed: { label: "Confirmed", bg: "var(--color-info-bg)", color: "var(--color-info-fg)" },
  fulfilled: { label: "Fulfilled", bg: "var(--color-success-bg)", color: "var(--color-success-fg)" },
  cancelled: { label: "Cancelled", bg: "var(--color-danger-bg)", color: "var(--color-danger-fg)" },
};

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--color-divider)", color: "var(--color-subtle)" },
  sent: { label: "Sent", bg: "var(--color-info-bg)", color: "var(--color-info-fg)" },
  partially_paid: { label: "Partially paid", bg: "var(--color-warning-bg)", color: "var(--color-warning-fg)" },
  paid: { label: "Paid", bg: "var(--color-success-bg)", color: "var(--color-success-fg)" },
  void: { label: "Void", bg: "var(--color-danger-bg)", color: "var(--color-danger-fg)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function formatMonthYear(date: Date): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "warning" | "danger";
};

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: MetricCardProps) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning-fg"
        : "text-subtle";
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardDescription className={cn("flex items-center gap-1.5 text-xs font-medium", toneClass)}>
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl font-medium tabular-nums tracking-tight">
          {value}
        </CardTitle>
        {helper ? <p className="mt-1 text-[11px] text-subtle">{helper}</p> : null}
      </CardHeader>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomerPortfolioPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "prices") as "prices" | "orders" | "invoices";
  const ordersPage = Math.max(1, Number(searchParams.get("ordersPage") ?? 1));
  const ordersPer = Number(searchParams.get("ordersPer") ?? 10) || 10;
  const invoicesPage = Math.max(1, Number(searchParams.get("invoicesPage") ?? 1));
  const invoicesPer = Number(searchParams.get("invoicesPer") ?? 10) || 10;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<
    "archive" | "restore" | "permanent-delete" | null
  >(null);
  const [lifecyclePending, setLifecyclePending] = useState(false);
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecordPayment = can(currentUser?.role, "record_payment");
  useEffect(() => {
    if (sessionStorage.getItem(`cust-details-${customerId}`) === "open") {
      setDetailsOpen(true);
    }
  }, [customerId]);

  const { data: portfolio, isLoading, error } = useCustomerPortfolio(customerId);
  const { data: ordersData, isLoading: ordersLoading } = useCustomerOrdersPage(customerId, {
    page: ordersPage,
    pageSize: ordersPer,
  });
  const { data: invoicesData, isLoading: invoicesLoading } = useCustomerInvoicesPage(customerId, {
    page: invoicesPage,
    pageSize: invoicesPer,
  });

  const customer = portfolio?.customer;
  useSetBreadcrumbLabel(`/customers/${customerId}`, customer?.name);

  if (!isUuid(customerId)) return <PageError message="Invalid customer ID." />;
  if (isLoading) return <PageLoading message="Loading customer..." />;
  if (error) return <PageError message={(error as Error).message} />;
  if (!portfolio || !customer) return null;

  const { metrics, totalOrdersCount, totalInvoicesCount } = portfolio;

  function setParams(updates: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) sp.set(k, v);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function toggleDetails() {
    setDetailsOpen(prev => {
      const next = !prev;
      sessionStorage.setItem(`cust-details-${customerId}`, next ? "open" : "closed");
      return next;
    });
  }

  const isArchived = !!customer.archivedAt;

  async function handleLifecycleConfirm() {
    if (!lifecycleAction) return;
    setLifecyclePending(true);
    try {
      if (lifecycleAction === "archive") {
        await archiveCustomerAction(customer.id);
        toast.success("Customer archived.");
      } else if (lifecycleAction === "restore") {
        await restoreCustomerAction(customer.id);
        toast.success("Customer restored.");
      } else {
        await permanentlyDeleteCustomerAction(customer.id);
        toast.success("Customer deleted.");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      setLifecycleAction(null);
      if (lifecycleAction === "permanent-delete") {
        router.push("/customers");
      } else {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLifecyclePending(false);
    }
  }

  const primaryAddress =
    customer.addresses.find(a => a.isDefault) ?? customer.addresses[0] ?? null;
  const city = primaryAddress
    ? [primaryAddress.city, primaryAddress.state].filter(Boolean).join(", ")
    : null;

  const balanceTone = parseFloat(metrics.balanceDue) > 0 ? "danger" : "default";
  const openOrdersTone = metrics.openOrdersCount > 0 ? "warning" : "default";

  const TABS = [
    { id: "prices", label: "Prices", count: null },
    { id: "orders", label: "Orders", count: totalOrdersCount },
    { id: "invoices", label: "Invoices", count: totalInvoicesCount },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero row */}
      <div className="flex items-start gap-4">
        <div className="flex size-13 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {initials(customer.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-medium leading-tight text-ink">
              {customer.name}
            </h1>
            {isArchived ? (
              <Badge
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              >
                Archived
              </Badge>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer.phoneNumber && (
              <span className="flex items-center gap-1 text-sm text-subtle">
                <Phone className="size-3.5 shrink-0" />
                {formatPhone(customer.phoneNumber)}
              </span>
            )}
            {city && <span className="text-sm text-subtle">{city}</span>}
            <span className="text-sm text-subtle">
              Customer since {formatMonthYear(customer.createdAt)}
            </span>
            {isArchived && customer.archivedAt ? (
              <span className="text-sm text-subtle">
                Archived {formatDisplayDate(customer.archivedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isArchived ? (
            <>
              <Button
                size="sm"
                onClick={() => setLifecycleAction("restore")}
              >
                <ArchiveRestore className="size-4" />
                Restore
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLifecycleAction("permanent-delete")}
              >
                <Trash2 className="size-4" />
                Delete permanently
              </Button>
            </>
          ) : (
            <>
              {canRecordPayment && parseFloat(metrics.balanceDue) > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkPaymentOpen(true)}
                >
                  <Receipt className="size-4" />
                  Record payment
                </Button>
              ) : null}
              <Button size="sm" asChild>
                <Link href={`/orders/new?customerId=${customer.id}`}>
                  <Plus className="size-4" />
                  New order
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/customers/${customer.id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLifecycleAction("archive")}
              >
                <Archive className="size-4" />
                Archive
              </Button>
            </>
          )}
        </div>
      </div>

      <BulkPaymentEntryDialog
        open={bulkPaymentOpen}
        onOpenChange={setBulkPaymentOpen}
        customerId={customer.id}
        customerName={customer.name}
      />

      <AlertDialog
        open={!!lifecycleAction}
        onOpenChange={open => {
          if (!open && !lifecyclePending) setLifecycleAction(null);
        }}
      >
        <AlertDialogContent>
          {lifecycleAction === "archive" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive customer</AlertDialogTitle>
                <AlertDialogDescription>
                  Archive <strong>{customer.name}</strong>? They&apos;ll be hidden from
                  order and invoice lookups, but past orders, invoices, and payments
                  stay intact. You can restore them later from the Archived tab.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={lifecyclePending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLifecycleConfirm}
                  disabled={lifecyclePending}
                >
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : lifecycleAction === "restore" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore customer</AlertDialogTitle>
                <AlertDialogDescription>
                  Restore <strong>{customer.name}</strong>? They&apos;ll be visible
                  again everywhere customers appear.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={lifecyclePending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLifecycleConfirm}
                  disabled={lifecyclePending}
                >
                  Restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : lifecycleAction === "permanent-delete" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete permanently</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete <strong>{customer.name}</strong> permanently? This can&apos;t
                  be undone. If the customer has any orders or invoices, the delete
                  will fail — archive them instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={lifecyclePending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleLifecycleConfirm}
                  disabled={lifecyclePending}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Balance due"
          value={formatMoney(metrics.balanceDue)}
          helper="Open balance on non-void invoices."
          tone={balanceTone}
        />
        <MetricCard
          icon={TrendingUp}
          label="Total sold"
          value={formatMoney(metrics.totalRevenue)}
          helper="Sum of all non-void invoices."
        />
        <MetricCard icon={DollarSign} label="Total paid" value={formatMoney(metrics.totalPaid)} />
        <MetricCard
          icon={ShoppingCart}
          label="Open orders"
          value={String(metrics.openOrdersCount)}
          helper="Pending and confirmed orders."
          tone={openOrdersTone}
        />
      </div>

      {/* Account details (collapsible) */}
      <Card className="gap-0 overflow-hidden rounded-xl p-0 shadow-none">
        <button
          onClick={toggleDetails}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <span className="text-sm font-semibold text-ink">Account details</span>
          <ChevronDown
            className={cn(
              "size-4 text-subtle transition-transform duration-200",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
        {detailsOpen && (
          <div className="border-t border-border-default px-6 py-5">
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-subtle">Invoice prefix</p>
                <p className="mt-0.5 text-sm font-medium">{customer.abbreviation ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Email</p>
                <p className="mt-0.5 text-sm font-medium break-all">
                  {customer.email ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-subtle">Phone</p>
                <p className="mt-0.5 text-sm font-medium">
                  {customer.phoneNumber ? formatPhone(customer.phoneNumber) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-subtle">Tax ID</p>
                <p className="mt-0.5 text-sm font-medium font-mono tabular-nums">
                  {customer.taxId ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-subtle">Payment terms</p>
                <p className="mt-0.5 text-sm font-medium">
                  {customer.netDays == null
                    ? "—"
                    : customer.netDays === 0
                      ? "Due on receipt"
                      : `Net ${customer.netDays}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-subtle">Fuel surcharge</p>
                <p className="mt-0.5 text-sm font-medium">
                  {customer.fuelSurchargeAmount != null
                    ? formatMoney(customer.fuelSurchargeAmount)
                    : "—"}
                </p>
              </div>
            </div>
            {customer.addresses.length > 0 && (
              <div className="mt-5 border-t border-border-default pt-5">
                <p className="mb-3 text-xs font-medium text-subtle">Addresses</p>
                <div className="space-y-3">
                  {customer.addresses.map(addr => {
                    const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
                    return (
                      <div key={addr.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{addr.street}</p>
                          {line2 && <p className="text-xs text-subtle">{line2}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {addr.addressType}
                          </Badge>
                          {addr.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tab bar — sticky below topbar */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-border-default bg-card px-4">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setParams({ tab: t.id })}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-ink"
                  : "border-transparent text-subtle hover:text-ink",
              )}
            >
              {t.label}
              {t.count !== null && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 rounded-full px-1.5 text-[11px]",
                    tab === t.id
                      ? "bg-forest-mid text-card-warm"
                      : "bg-surface-deep text-subtle",
                  )}
                >
                  {t.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panes */}
      {tab === "prices" && <CustomerPriceSection customerId={customerId} />}

      {tab === "orders" && (
        <>
          {ordersLoading ? (
            <PageLoading message="Loading orders..." />
          ) : !ordersData?.data?.length ? (
            <p className="text-sm text-subtle">No orders on record.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-border-default bg-card py-0 text-ink shadow-none ring-0">
              <Table className="text-[13px] text-ink-warm">
                <TableHeader>
                  <TableRow className="border-divider hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Order #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Due
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-right text-xs font-medium text-subtle">
                      Items
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-right text-xs font-medium text-subtle">
                      Total
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Status
                    </TableHead>
                    <TableHead className="h-auto w-px bg-divider px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersData.data.map(order => {
                    const s = ORDER_STATUS[order.status] ?? {
                      label: order.status,
                      bg: "var(--color-divider)",
                      color: "var(--color-subtle)",
                    };
                    return (
                      <TableRow
                        key={order.id}
                        className="group/row border-divider hover:bg-divider"
                      >
                        <TableCell className="px-4 py-2.5 align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {order.orderNumber ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                          {formatDisplayDate(order.orderDate)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                          {formatDisplayDate(order.dueDate) ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right align-middle">
                          <span className="font-mono text-xs tabular-nums">{order.itemsCount}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {formatMoney(order.total)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle">
                          <StatusPill label={s.label} bg={s.bg} color={s.color} />
                        </TableCell>
                        <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="outline"
                              size="xs"
                              className="border-border-default bg-card text-xs text-ink-warm hover:bg-divider"
                            >
                              <Link href={`/orders/${order.id}`} onClick={e => e.stopPropagation()}>
                                View
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePager
                total={ordersData.total}
                perPage={ordersPer}
                page={ordersPage}
                onPageChange={p => setParams({ ordersPage: String(p) })}
                onPerPageChange={per => setParams({ ordersPer: String(per), ordersPage: "1" })}
              />
            </Card>
          )}
        </>
      )}

      {tab === "invoices" && (
        <>
          {invoicesLoading ? (
            <PageLoading message="Loading invoices..." />
          ) : !invoicesData?.data?.length ? (
            <p className="text-sm text-subtle">No invoices on record.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-border-default bg-card py-0 text-ink shadow-none ring-0">
              <Table className="text-[13px] text-ink-warm">
                <TableHeader>
                  <TableRow className="border-divider hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Invoice #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Due
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Status
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-right text-xs font-medium text-subtle">
                      Total
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-right text-xs font-medium text-subtle">
                      Balance
                    </TableHead>
                    <TableHead className="h-auto w-px bg-divider px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesData.data.map(inv => {
                    const s = INVOICE_STATUS[inv.status] ?? {
                      label: inv.status,
                      bg: "var(--color-divider)",
                      color: "var(--color-subtle)",
                    };
                    const hasBalance = parseFloat(inv.balanceDue) > 0;
                    return (
                      <TableRow
                        key={inv.id}
                        className="group/row border-divider hover:bg-divider"
                      >
                        <TableCell className="px-4 py-2.5 align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {inv.invoiceNumber}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                          {formatDisplayDate(inv.invoiceDate)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                          {formatDisplayDate(inv.dueDate) ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle">
                          <StatusPill label={s.label} bg={s.bg} color={s.color} />
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {formatMoney(inv.totalAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right align-middle">
                          <span
                            className={cn(
                              "font-mono text-xs tabular-nums",
                              hasBalance && "font-semibold text-destructive",
                            )}
                          >
                            {formatMoney(inv.balanceDue)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="outline"
                              size="xs"
                              className="border-border-default bg-card text-xs text-ink-warm hover:bg-divider"
                            >
                              <Link
                                href={`/invoices/${inv.id}`}
                                onClick={e => e.stopPropagation()}
                              >
                                View
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePager
                total={invoicesData.total}
                perPage={invoicesPer}
                page={invoicesPage}
                onPageChange={p => setParams({ invoicesPage: String(p) })}
                onPerPageChange={per => setParams({ invoicesPer: String(per), invoicesPage: "1" })}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
