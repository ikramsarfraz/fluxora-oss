"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  DollarSign,
  FileText,
  Pencil,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  useDeleteSupplier,
  useSupplierInvoicesPage,
  useSupplierLotsPage,
  useSupplierPortfolio,
} from "../hooks/use-suppliers";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PageError } from "@/components/page-error";
import { PageLoading } from "@/components/page-loading";
import { StatusPill } from "@/components/listing-page";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { SupplierEditPaymentTermsDialog } from "./supplier-edit-payment-terms-dialog";

// ── Status / helpers ──────────────────────────────────────────────────────────

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#f5f5f4", color: "#78716c" },
  completed: { label: "Completed", bg: "oklch(96% 0.04 155)", color: "oklch(58% 0.13 155)" },
  void: { label: "Void", bg: "oklch(97% 0.04 25)", color: "oklch(55% 0.22 25)" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function formatMonthYear(date: Date | string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = typeof date === "string" ? new Date(date) : date;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPaymentTerms(netDays: number | null | undefined): string {
  if (netDays == null) return "Net-0 (not set)";
  if (netDays === 0) return "Net-0 (due on invoice date)";
  return `Net-${netDays}`;
}

// ── Metric card ───────────────────────────────────────────────────────────────

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

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editTermsOpen, setEditTermsOpen] = useState(false);

  const tab = (searchParams.get("tab") ?? "invoices") as "invoices" | "lots";
  const invoicesPage = Math.max(1, Number(searchParams.get("invoicesPage") ?? 1));
  const invoicesPer = Number(searchParams.get("invoicesPer") ?? 10) || 10;
  const lotsPage = Math.max(1, Number(searchParams.get("lotsPage") ?? 1));
  const lotsPer = Number(searchParams.get("lotsPer") ?? 10) || 10;

  const { data: portfolio, isLoading, error } = useSupplierPortfolio(supplierId);
  const { data: invoicesData, isLoading: invoicesLoading } = useSupplierInvoicesPage(supplierId, {
    page: invoicesPage,
    pageSize: invoicesPer,
  });
  const { data: lotsData, isLoading: lotsLoading } = useSupplierLotsPage(supplierId, {
    page: lotsPage,
    pageSize: lotsPer,
  });

  const supplier = portfolio?.supplier;
  useSetBreadcrumbLabel(`/suppliers/${supplierId}`, supplier?.name);

  const deleteSupplier = useDeleteSupplier();

  if (!isUuid(supplierId)) return <PageError message="Invalid supplier ID." />;
  if (isLoading) return <PageLoading message="Loading supplier..." />;
  if (error) return <PageError message={(error as Error).message} />;
  if (!portfolio || !supplier) return <PageError message="Supplier not found." />;

  const { metrics } = portfolio;
  const balanceTone = parseFloat(metrics.openBalance) > 0 ? "danger" : "default";

  function setParams(updates: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) sp.set(k, v);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  const TABS = [
    { id: "invoices", label: "Invoices", count: metrics.totalInvoicesCount },
    { id: "lots", label: "Lots received", count: lotsData?.total ?? null },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="flex size-13 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {initials(supplier.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight text-stone-ink">
            {supplier.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="outline" className="text-xs tabular-nums">
              {formatPaymentTerms(supplier.netDays)}
            </Badge>
            <span className="text-sm text-stone-muted">
              Supplier since {formatMonthYear(supplier.createdAt)}
            </span>
            {metrics.lastInvoiceDate ? (
              <span className="text-sm text-stone-muted">
                Last invoice {formatDisplayDate(metrics.lastInvoiceDate)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!supplier.archivedAt ? (
            <>
              <Button size="sm" asChild>
                <Link href={`/supplier-invoices/new?supplierId=${supplier.id}`}>
                  <FileText className="size-4" />
                  Record bill
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/suppliers/${supplier.id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Open balance"
          value={formatMoney(metrics.openBalance)}
          helper={`${metrics.openInvoicesCount} unpaid invoice${metrics.openInvoicesCount === 1 ? "" : "s"}`}
          tone={balanceTone}
        />
        <MetricCard
          icon={TrendingUp}
          label="Total spent"
          value={formatMoney(metrics.totalSpent)}
          helper="Sum of all bills from this supplier."
        />
        <MetricCard
          icon={DollarSign}
          label="Total paid"
          value={formatMoney(metrics.totalPaid)}
        />
        <MetricCard
          icon={Boxes}
          label="Invoices"
          value={String(metrics.totalInvoicesCount)}
          helper="All-time supplier invoices."
        />
      </div>

      {/* Payment terms editor + delete (compact, below KPIs) */}
      <Card className="overflow-hidden rounded-xl p-0 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-muted">Payment terms</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums">
              {formatPaymentTerms(supplier.netDays)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!supplier.archivedAt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTermsOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit terms
              </Button>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{supplier.name}</strong> and all associated
                    data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleteSupplier.isPending}
                    onClick={() => {
                      deleteSupplier.mutate(supplierId, {
                        onSuccess: () => router.push("/suppliers"),
                      });
                    }}
                  >
                    {deleteSupplier.isPending ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>

      <SupplierEditPaymentTermsDialog
        supplierId={supplierId}
        supplierName={supplier.name}
        currentNetDays={supplier.netDays}
        open={editTermsOpen}
        onOpenChange={setEditTermsOpen}
      />

      {/* Tab bar */}
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
                      Invoice date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Received
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
                    const balance =
                      parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid);
                    const hasBalance = balance > 0;
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
                          {formatDisplayDate(inv.receiveDate)}
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
                            {formatMoney(balance.toFixed(2))}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="outline"
                              size="xs"
                              className="border-stone-line bg-stone-surface text-xs text-stone-ink2 hover:bg-stone-line2"
                            >
                              <Link
                                href={`/supplier-invoices/${inv.id}`}
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

      {tab === "lots" && (
        <>
          {lotsLoading ? (
            <PageLoading message="Loading lots..." />
          ) : !lotsData?.data?.length ? (
            <p className="text-sm text-stone-muted">No lots received from this supplier.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface py-0 text-stone-ink shadow-none ring-0">
              <Table className="text-[13px] text-stone-ink2">
                <TableHeader>
                  <TableRow className="border-stone-line2 hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Lot #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Received
                    </TableHead>
                    <TableHead className="h-auto select-none bg-stone-line2 px-4 py-2.5 text-xs font-medium text-stone-muted">
                      Expires
                    </TableHead>
                    <TableHead className="h-auto w-px bg-stone-line2 px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotsData.data.map(lot => (
                    <TableRow
                      key={lot.id}
                      className="group/row border-stone-line2 hover:bg-stone-line2"
                    >
                      <TableCell className="px-4 py-2.5 align-middle">
                        <span className="font-mono text-xs tabular-nums">{lot.lotNumber}</span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
                        {formatDisplayDate(lot.receiveDate)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 align-middle text-xs text-stone-muted">
                        {formatDisplayDate(lot.expirationDate)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            variant="outline"
                            size="xs"
                            className="border-stone-line bg-stone-surface text-xs text-stone-ink2 hover:bg-stone-line2"
                          >
                            <Link href={`/lots/${lot.id}`} onClick={e => e.stopPropagation()}>
                              View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                total={lotsData.total}
                perPage={lotsPer}
                page={lotsPage}
                onPageChange={p => setParams({ lotsPage: String(p) })}
                onPerPageChange={per => setParams({ lotsPer: String(per), lotsPage: "1" })}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
