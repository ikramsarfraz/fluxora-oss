"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  DollarSign,
  FileText,
  Globe,
  Mail,
  Pencil,
  Phone,
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
import {
  DetailPageSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
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
} from "@/components/ui/alert-dialog";

import { SupplierEditPaymentTermsDialog } from "./supplier-edit-payment-terms-dialog";

// ── Status / helpers ──────────────────────────────────────────────────────────

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--color-divider)", color: "var(--color-subtle)" },
  completed: { label: "Completed", bg: "var(--color-success-bg)", color: "var(--color-success-fg)" },
  void: { label: "Void", bg: "var(--color-danger-bg)", color: "var(--color-danger-fg)" },
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

// ── Contact / address card ───────────────────────────────────────────────────

type SupplierContactSlice = {
  netDays: number | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  taxId: string | null;
  accountNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  websiteUrl: string | null;
  notes: string | null;
};

function formatUsAddress(s: SupplierContactSlice): string | null {
  const cityRegionZip = [
    s.addressCity,
    [s.addressRegion, s.addressPostalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const lines = [s.addressLine1, s.addressLine2, cityRegionZip || null].filter(
    (l): l is string => Boolean(l && l.trim()),
  );
  return lines.length ? lines.join("\n") : null;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd className="text-sm text-ink">{value ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

function SupplierContactCard({
  supplier,
  supplierId,
  archived,
  onEditTerms,
  onDelete,
}: {
  supplier: SupplierContactSlice;
  supplierId: string;
  archived: boolean;
  onEditTerms: () => void;
  onDelete: () => void;
}) {
  const hasContact =
    supplier.primaryContactName ||
    supplier.primaryContactEmail ||
    supplier.primaryContactPhone;
  const address = formatUsAddress(supplier);
  const hasAccounting = supplier.accountNumber || supplier.taxId || supplier.websiteUrl;
  const hasNotes = Boolean(supplier.notes);
  const hasPaymentTerms = supplier.netDays !== null;

  if (!hasContact && !address && !hasAccounting && !hasNotes && !hasPaymentTerms) {
    return <SupplierContactCardEmpty supplierId={supplierId} archived={archived} />;
  }

  const hasGridContent = Boolean(hasContact || address || hasAccounting);

  return (
    <Card className="overflow-hidden rounded-xl p-6 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Supplier details</h3>
        {!archived ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/suppliers/${supplierId}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit details
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {hasContact ? (
          <dl className="flex flex-col gap-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-subtle">
              Primary contact
            </h4>
            <DetailItem label="Name" value={supplier.primaryContactName} />
            <DetailItem
              label="Email"
              value={
                supplier.primaryContactEmail ? (
                  <a
                    href={`mailto:${supplier.primaryContactEmail}`}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {supplier.primaryContactEmail}
                  </a>
                ) : null
              }
            />
            <DetailItem
              label="Phone"
              value={
                supplier.primaryContactPhone ? (
                  <a
                    href={`tel:${supplier.primaryContactPhone}`}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {supplier.primaryContactPhone}
                  </a>
                ) : null
              }
            />
          </dl>
        ) : null}

        {address ? (
          <dl className="flex flex-col gap-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-subtle">
              Remit-to address
            </h4>
            <DetailItem
              label="Mailing address"
              value={<span className="whitespace-pre-line">{address}</span>}
            />
          </dl>
        ) : null}

        {hasAccounting ? (
          <dl className="flex flex-col gap-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-subtle">
              Accounting
            </h4>
            <DetailItem
              label="Account number"
              value={
                supplier.accountNumber ? (
                  <span className="font-mono tabular-nums">
                    {supplier.accountNumber}
                  </span>
                ) : null
              }
            />
            <DetailItem
              label="Tax ID (EIN)"
              value={
                supplier.taxId ? (
                  <span className="font-mono tabular-nums">{supplier.taxId}</span>
                ) : null
              }
            />
            <DetailItem
              label="Website"
              value={
                supplier.websiteUrl ? (
                  <a
                    href={supplier.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {supplier.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : null
              }
            />
          </dl>
        ) : null}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          hasGridContent && "mt-6 border-t border-border-default pt-4",
        )}
      >
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-subtle">
            Payment terms
          </h4>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-ink">
            {formatPaymentTerms(supplier.netDays)}
          </p>
        </div>
        {!archived ? (
          <Button type="button" variant="outline" size="sm" onClick={onEditTerms}>
            <Pencil className="h-3.5 w-3.5" />
            Edit terms
          </Button>
        ) : null}
      </div>

      {hasNotes ? (
        <div className="mt-6 border-t border-border-default pt-4">
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-subtle">
            Notes
          </h4>
          <p className="whitespace-pre-line text-sm text-ink-warm">{supplier.notes}</p>
        </div>
      ) : null}
    </Card>
  );
}

function SupplierQuickContactActions({
  supplier,
}: {
  supplier: {
    primaryContactEmail: string | null;
    primaryContactPhone: string | null;
    websiteUrl: string | null;
  };
}) {
  const items: Array<{ href: string; label: string; icon: LucideIcon; external?: boolean }> = [];
  if (supplier.primaryContactEmail) {
    items.push({
      href: `mailto:${supplier.primaryContactEmail}`,
      label: `Email ${supplier.primaryContactEmail}`,
      icon: Mail,
    });
  }
  if (supplier.primaryContactPhone) {
    items.push({
      href: `tel:${supplier.primaryContactPhone}`,
      label: `Call ${supplier.primaryContactPhone}`,
      icon: Phone,
    });
  }
  if (supplier.websiteUrl) {
    items.push({
      href: supplier.websiteUrl,
      label: `Open ${supplier.websiteUrl}`,
      icon: Globe,
      external: true,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mr-1 flex items-center gap-1 border-r border-border-default pr-2">
      {items.map(({ href, label, icon: Icon, external }) => (
        <Button
          key={label}
          variant="ghost"
          size="icon-sm"
          asChild
          title={label}
          aria-label={label}
        >
          <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <Icon className="size-4" />
          </a>
        </Button>
      ))}
    </div>
  );
}

function SupplierContactCardEmpty({
  supplierId,
  archived,
}: {
  supplierId: string;
  archived: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border-dashed p-6 shadow-none">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Supplier details</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-subtle">
            Add a primary contact, remit-to address, and tax ID to unlock
            AP-chase emails, check printing, and 1099-NEC reporting.
          </p>
        </div>
        {!archived ? (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/suppliers/${supplierId}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Complete profile
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editTermsOpen, setEditTermsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
  if (isLoading) return <DetailPageSkeleton sections={4} />;
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
          <h1 className="truncate text-2xl font-medium leading-tight text-ink">
            {supplier.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="outline" className="text-xs tabular-nums">
              {formatPaymentTerms(supplier.netDays)}
            </Badge>
            <span className="text-sm text-subtle">
              Supplier since {formatMonthYear(supplier.createdAt)}
            </span>
            {metrics.lastInvoiceDate ? (
              <span className="text-sm text-subtle">
                Last invoice {formatDisplayDate(metrics.lastInvoiceDate)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SupplierQuickContactActions supplier={supplier} />
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

      <SupplierContactCard
        supplier={supplier}
        supplierId={supplierId}
        archived={Boolean(supplier.archivedAt)}
        onEditTerms={() => setEditTermsOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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

      <SupplierEditPaymentTermsDialog
        supplierId={supplierId}
        supplierName={supplier.name}
        currentNetDays={supplier.netDays}
        open={editTermsOpen}
        onOpenChange={setEditTermsOpen}
      />

      {/* Tab bar */}
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
      {tab === "invoices" && (
        <>
          {invoicesLoading ? (
            <TableSkeleton rows={5} columns={6} />
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
                      Invoice date
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Received
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
                    const balance =
                      parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid);
                    const hasBalance = balance > 0;
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
                              className="border-border-default bg-card text-xs text-ink-warm hover:bg-divider"
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
            <TableSkeleton rows={5} columns={3} />
          ) : !lotsData?.data?.length ? (
            <p className="text-sm text-subtle">No lots received from this supplier.</p>
          ) : (
            <Card className="gap-0 overflow-hidden rounded-[10px] border border-border-default bg-card py-0 text-ink shadow-none ring-0">
              <Table className="text-[13px] text-ink-warm">
                <TableHeader>
                  <TableRow className="border-divider hover:bg-transparent">
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Lot #
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Received
                    </TableHead>
                    <TableHead className="h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle">
                      Expires
                    </TableHead>
                    <TableHead className="h-auto w-px bg-divider px-4 py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotsData.data.map(lot => (
                    <TableRow
                      key={lot.id}
                      className="group/row border-divider hover:bg-divider"
                    >
                      <TableCell className="px-4 py-2.5 align-middle">
                        <span className="font-mono text-xs tabular-nums">{lot.lotNumber}</span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                        {formatDisplayDate(lot.receiveDate)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 align-middle text-xs text-subtle">
                        {formatDisplayDate(lot.expirationDate)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            variant="outline"
                            size="xs"
                            className="border-border-default bg-card text-xs text-ink-warm hover:bg-divider"
                          >
                            <Link href={`/inventory/lots/${lot.id}`} onClick={e => e.stopPropagation()}>
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
