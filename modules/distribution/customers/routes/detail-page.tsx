"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  DollarSign,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

// ── Status config ─────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sales_order: { label: "Draft", bg: "#f5f5f4", color: "#78716c" },
  confirmed: { label: "Confirmed", bg: "oklch(96% 0.03 240)", color: "oklch(60% 0.15 240)" },
  fulfilled: { label: "Fulfilled", bg: "oklch(96% 0.04 155)", color: "oklch(58% 0.13 155)" },
  cancelled: { label: "Cancelled", bg: "oklch(97% 0.04 25)", color: "oklch(55% 0.22 25)" },
};

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#f5f5f4", color: "#78716c" },
  sent: { label: "Sent", bg: "oklch(96% 0.03 240)", color: "oklch(60% 0.15 240)" },
  partially_paid: { label: "Partially paid", bg: "oklch(97% 0.04 70)", color: "oklch(60% 0.14 70)" },
  paid: { label: "Paid", bg: "oklch(96% 0.04 155)", color: "oklch(58% 0.13 155)" },
  void: { label: "Void", bg: "oklch(97% 0.04 25)", color: "oklch(55% 0.22 25)" },
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
        ? "text-status-warn"
        : "text-stone-muted";
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardDescription className={cn("flex items-center gap-1.5 text-xs font-medium", toneClass)}>
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </CardTitle>
        {helper ? <p className="mt-1 text-[11px] text-stone-muted">{helper}</p> : null}
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
          <h1 className="truncate text-2xl font-bold leading-tight text-stone-ink">
            {customer.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer.phoneNumber && (
              <span className="flex items-center gap-1 text-sm text-stone-muted">
                <Phone className="size-3.5 shrink-0" />
                {formatPhone(customer.phoneNumber)}
              </span>
            )}
            {city && <span className="text-sm text-stone-muted">{city}</span>}
            <span className="text-sm text-stone-muted">
              Customer since {formatMonthYear(customer.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </div>

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
          <span className="text-sm font-semibold text-stone-ink">Account details</span>
          <ChevronDown
            className={cn(
              "size-4 text-stone-muted transition-transform duration-200",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
        {detailsOpen && (
          <div className="border-t border-stone-line px-6 py-5">
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-stone-muted">Abbreviation</p>
                <p className="mt-0.5 text-sm font-medium">{customer.abbreviation ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-stone-muted">Phone</p>
                <p className="mt-0.5 text-sm font-medium">
                  {customer.phoneNumber ? formatPhone(customer.phoneNumber) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-muted">Fuel surcharge</p>
                <p className="mt-0.5 text-sm font-medium">
                  {customer.fuelSurchargeAmount != null
                    ? formatMoney(customer.fuelSurchargeAmount)
                    : "—"}
                </p>
              </div>
            </div>
            {customer.addresses.length > 0 && (
              <div className="mt-5 border-t border-stone-line pt-5">
                <p className="mb-3 text-xs font-medium text-stone-muted">Addresses</p>
                <div className="space-y-3">
                  {customer.addresses.map(addr => {
                    const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
                    return (
                      <div key={addr.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{addr.street}</p>
                          {line2 && <p className="text-xs text-stone-muted">{line2}</p>}
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
      <div className="sticky top-16 z-20 -mx-4 border-b border-stone-line bg-white px-4">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setParams({ tab: t.id })}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-stone-ink"
                  : "border-transparent text-stone-muted hover:text-stone-ink",
              )}
            >
              {t.label}
              {t.count !== null && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 rounded-full px-1.5 text-[11px]",
                    tab === t.id
                      ? "bg-stone-ink text-stone-surface"
                      : "bg-stone-line text-stone-muted",
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
            <p className="text-sm text-stone-muted">No orders on record.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface py-0 text-stone-ink shadow-none ring-0">
              <Table className="text-[13px] text-stone-ink2">
                <TableHeader>
                  <TableRow className="border-stone-line2 hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Order #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Due
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-right text-xs font-medium text-stone-muted">
                      Items
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-right text-xs font-medium text-stone-muted">
                      Total
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Status
                    </TableHead>
                    <TableHead className="h-auto w-px bg-stone-line2 px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersData.data.map(order => {
                    const s = ORDER_STATUS[order.status] ?? {
                      label: order.status,
                      bg: "#f5f5f4",
                      color: "#78716c",
                    };
                    return (
                      <TableRow
                        key={order.id}
                        className="group/row border-stone-line2 hover:bg-stone-line2"
                      >
                        <TableCell className="px-4 py-2.5 align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {order.orderNumber ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
                          {formatDisplayDate(order.orderDate)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
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
                              className="border-stone-line bg-stone-surface text-xs text-stone-ink2 hover:bg-stone-line2"
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
            <p className="text-sm text-stone-muted">No invoices on record.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface py-0 text-stone-ink shadow-none ring-0">
              <Table className="text-[13px] text-stone-ink2">
                <TableHeader>
                  <TableRow className="border-stone-line2 hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Invoice #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Due
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Status
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-right text-xs font-medium text-stone-muted">
                      Total
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-right text-xs font-medium text-stone-muted">
                      Balance
                    </TableHead>
                    <TableHead className="h-auto w-px bg-stone-line2 px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesData.data.map(inv => {
                    const s = INVOICE_STATUS[inv.status] ?? {
                      label: inv.status,
                      bg: "#f5f5f4",
                      color: "#78716c",
                    };
                    const hasBalance = parseFloat(inv.balanceDue) > 0;
                    return (
                      <TableRow
                        key={inv.id}
                        className="group/row border-stone-line2 hover:bg-stone-line2"
                      >
                        <TableCell className="px-4 py-2.5 align-middle">
                          <span className="font-mono text-xs tabular-nums">
                            {inv.invoiceNumber}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
                          {formatDisplayDate(inv.invoiceDate)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
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
                              className="border-stone-line bg-stone-surface text-xs text-stone-ink2 hover:bg-stone-line2"
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
