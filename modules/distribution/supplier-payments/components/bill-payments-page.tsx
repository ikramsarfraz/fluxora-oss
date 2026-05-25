"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Receipt, X } from "lucide-react";
import { toast } from "sonner";

import { ListingErrorState, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBillPaymentsPage,
  useBillPaymentsSummary,
} from "../hooks/use-bill-payments";
import {
  useBulkReconcileSupplierInvoicePayments,
  useBulkUnreconcileSupplierInvoicePayments,
} from "@/modules/distribution/supplier-invoices/hooks/use-supplier-invoices";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can } from "@/lib/auth/permissions";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type {
  BillPaymentFilters,
  BillPaymentListItem,
  BillPaymentListSort,
  BillPaymentMethod,
} from "../services/supplier-payments";
import { formatBillPaymentReference } from "../utils/payment-reference";
import { GlobalBillPaymentEntryDialog } from "./global-bill-payment-entry-dialog";

type BillPaymentRow = BillPaymentListItem;

const METHOD_LABELS: Record<BillPaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

const METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
];

const RECONCILED_OPTIONS: Array<{
  value: "unreconciled" | "all" | "reconciled";
  label: string;
}> = [
  { value: "unreconciled", label: "Unreconciled" },
  { value: "reconciled", label: "Reconciled" },
  { value: "all", label: "All" },
];

function buildColumns(
  selectedIds: Set<string>,
  toggleRow: (id: string) => void,
  toggleAll: (checked: boolean) => void,
  allOnPageSelected: boolean,
  someOnPageSelected: boolean,
): ListingColumn<BillPaymentRow>[] {
  return [
    {
      key: "select",
      header: (
        <Checkbox
          checked={
            allOnPageSelected
              ? true
              : someOnPageSelected
                ? "indeterminate"
                : false
          }
          onCheckedChange={v => toggleAll(v === true)}
          aria-label={
            allOnPageSelected
              ? "Deselect all on this page"
              : "Select all on this page"
          }
        />
      ),
      render: row => ({
        primary: (
          <Checkbox
            checked={selectedIds.has(row.id)}
            onCheckedChange={() => toggleRow(row.id)}
            onClick={e => e.stopPropagation()}
            aria-label={`Select bill payment ${row.id.slice(0, 8)}`}
          />
        ),
      }),
    },
    {
      key: "paymentDate",
      header: "Date",
      sortKey: "paymentDate",
      render: row => ({
        primary: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Link
              href={`/bill-payments/${row.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={e => e.stopPropagation()}
            >
              <MonoText>{formatDisplayDate(row.paymentDate)}</MonoText>
            </Link>
            {row.reconciledAt ? (
              <CheckCircle2
                className="size-3.5 text-success-fg"
                aria-label={
                  row.reconciliationReference
                    ? `Reconciled · ${row.reconciliationReference}`
                    : "Reconciled"
                }
              />
            ) : null}
          </span>
        ),
      }),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: row => {
        const supplier = row.supplierInvoice?.supplier;
        return supplier
          ? { primary: <span style={{ fontWeight: 500 }}>{supplier.name}</span> }
          : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> };
      },
    },
    {
      key: "bill",
      header: "Bill",
      render: row => {
        const invoice = row.supplierInvoice;
        return invoice
          ? {
              primary: (
                <Link
                  href={`/supplier-invoices/${invoice.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={e => e.stopPropagation()}
                >
                  <MonoText>{invoice.invoiceNumber}</MonoText>
                </Link>
              ),
            }
          : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> };
      },
    },
    {
      key: "amount",
      header: "Amount",
      sortKey: "amount",
      align: "right",
      render: row => ({ primary: <MonoText>{formatMoney(row.amount)}</MonoText> }),
    },
    {
      key: "paymentMethod",
      header: "Method",
      render: row => ({
        primary: (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 100,
              background: "var(--color-divider)",
              color: "var(--color-ink-warm)",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}
          </span>
        ),
      }),
    },
    {
      key: "reference",
      header: "Reference",
      render: row => {
        const ref = formatBillPaymentReference(row);
        return ref
          ? { primary: <MonoText>{ref}</MonoText> }
          : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> };
      },
    },
    {
      key: "recordedBy",
      header: "Recorded by",
      render: row => ({
        primary:
          row.createdBy?.fullName ?? (
            <span style={{ color: "var(--color-subtle)" }}>—</span>
          ),
      }),
    },
  ];
}

export function BillPaymentsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecordPayment = can(currentUser?.role, "record_supplier_payment");
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reconcileRef, setReconcileRef] = useState<string>("");
  const bulkReconcile = useBulkReconcileSupplierInvoicePayments();
  const bulkUnreconcile = useBulkUnreconcileSupplierInvoicePayments();

  const pagination = useUrlPaginationState<BillPaymentListSort, BillPaymentFilters>({
    defaultSort: "paymentDate",
    defaultDirection: "desc",
    defaultFilters: {
      method: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      reconciled: "unreconciled",
    },
  });

  const filtersForQuery: BillPaymentFilters = {
    method: pagination.filters.method,
    dateFrom: pagination.filters.dateFrom,
    dateTo: pagination.filters.dateTo,
    reconciled:
      (pagination.filters.reconciled as
        | "all"
        | "reconciled"
        | "unreconciled"
        | undefined) ?? "unreconciled",
  };

  const { data, isLoading, isFetching, error, refetch } = useBillPaymentsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: filtersForQuery,
  });

  const { data: summary, isLoading: summaryLoading } = useBillPaymentsSummary(
    filtersForQuery,
    pagination.search,
  );

  const hasActiveFilters = Boolean(
    pagination.filters.method ||
      pagination.filters.dateFrom ||
      pagination.filters.dateTo ||
      (pagination.filters.reconciled &&
        pagination.filters.reconciled !== "unreconciled"),
  );

  const rows = data?.data ?? [];
  const rowIdsOnPage = useMemo(() => rows.map(r => r.id), [rows]);

  if (error) {
    return (
      <ListingErrorState
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }
  const allOnPageSelected =
    rowIdsOnPage.length > 0 && rowIdsOnPage.every(id => selectedIds.has(id));
  const someOnPageSelected =
    rowIdsOnPage.some(id => selectedIds.has(id)) && !allOnPageSelected;

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage(checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) rowIdsOnPage.forEach(id => next.add(id));
      else rowIdsOnPage.forEach(id => next.delete(id));
      return next;
    });
  }

  const selectedRows = rows.filter(r => selectedIds.has(r.id));
  const allSelectedReconciled =
    selectedRows.length > 0 && selectedRows.every(r => r.reconciledAt !== null);

  async function handleReconcile() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await bulkReconcile.mutateAsync({
        ids,
        reference: reconcileRef || null,
      });
      toast.success(
        `Reconciled ${res.updated} payment${res.updated === 1 ? "" : "s"}.`,
      );
      setSelectedIds(new Set());
      setReconcileRef("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reconcile.");
    }
  }
  async function handleUnreconcile() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await bulkUnreconcile.mutateAsync(ids);
      toast.success(
        `Unreconciled ${res.updated} payment${res.updated === 1 ? "" : "s"}.`,
      );
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unreconcile.");
    }
  }

  const columns = buildColumns(
    selectedIds,
    toggleRow,
    toggleAllOnPage,
    allOnPageSelected,
    someOnPageSelected,
  );

  return (
    <div className="flex flex-col gap-4">
      <BillPaymentsSummaryStrip
        summary={summary}
        loading={summaryLoading}
        filtered={hasActiveFilters || Boolean(pagination.search)}
      />

      <BillPaymentsFilterBar
        filters={pagination.filters}
        onChangeMethod={value =>
          pagination.setFilter(
            "method",
            value === "all" ? undefined : (value as string),
          )
        }
        onChangeDateFrom={value =>
          pagination.setFilter("dateFrom", value || undefined)
        }
        onChangeDateTo={value =>
          pagination.setFilter("dateTo", value || undefined)
        }
        onChangeReconciled={value => {
          pagination.setFilter(
            "reconciled",
            value === "unreconciled" ? undefined : value,
          );
          setSelectedIds(new Set());
        }}
        onClear={() => {
          pagination.setFilters({
            method: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            reconciled: undefined,
          });
          setSelectedIds(new Set());
        }}
        anyActive={hasActiveFilters}
      />

      <ListingPage
        title="Bill payments"
        subtitle="Payments recorded against supplier bills."
        primaryAction={
          canRecordPayment ? (
            <Button onClick={() => setRecordOpen(true)} size="sm">
              <Receipt className="h-4 w-4" />
              Record payment
            </Button>
          ) : undefined
        }
        columns={columns}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/bill-payments/${row.id}`)}
        rowActions={[{ label: "View", href: row => `/bill-payments/${row.id}` }]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search supplier, bill, reference…"
        emptyTitle={
          hasActiveFilters || pagination.search
            ? "No bill payments match these filters"
            : "No bill payments yet"
        }
        emptyDescription={
          hasActiveFilters || pagination.search
            ? "Try clearing the filters above or widening the date range."
            : "Bill payments appear here once you record one against a completed supplier invoice."
        }
        page={data?.page ?? pagination.page}
        pageSize={data?.pageSize ?? pagination.pageSize}
        pageCount={data?.pageCount ?? 1}
        searchInput={pagination.searchInput}
        sort={pagination.sort}
        direction={pagination.direction}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        onSearchChange={pagination.setSearch}
        onSortChange={(key, dir) =>
          pagination.setSort(key as BillPaymentListSort, dir)
        }
      />

      <GlobalBillPaymentEntryDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
      />

      {selectedIds.size > 0 && canRecordPayment ? (
        <BulkReconcileBar
          count={selectedIds.size}
          referenceInput={reconcileRef}
          onReferenceChange={setReconcileRef}
          onReconcile={handleReconcile}
          onUnreconcile={handleUnreconcile}
          onClear={() => setSelectedIds(new Set())}
          pending={bulkReconcile.isPending || bulkUnreconcile.isPending}
          mode={allSelectedReconciled ? "unreconcile" : "reconcile"}
        />
      ) : null}
    </div>
  );
}

/**
 * Floating action bar visible when one or more bill-payment rows are
 * selected. Mirrors the AR-side BulkReconcileBar.
 */
function BulkReconcileBar({
  count,
  referenceInput,
  onReferenceChange,
  onReconcile,
  onUnreconcile,
  onClear,
  pending,
  mode,
}: {
  count: number;
  referenceInput: string;
  onReferenceChange: (value: string) => void;
  onReconcile: () => void;
  onUnreconcile: () => void;
  onClear: () => void;
  pending: boolean;
  mode: "reconcile" | "unreconcile";
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-border-soft bg-card/95 px-4 py-2.5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] backdrop-blur">
      <span className="text-xs font-medium text-ink">{count} selected</span>
      {mode === "reconcile" ? (
        <>
          <Input
            placeholder="Statement reference (optional)"
            value={referenceInput}
            onChange={e => onReferenceChange(e.target.value)}
            className="h-8 w-[220px] text-xs"
          />
          <Button size="sm" onClick={onReconcile} disabled={pending}>
            <CheckCircle2 className="size-4" />
            {pending ? "Marking…" : "Mark reconciled"}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={onUnreconcile} disabled={pending}>
          {pending ? "Working…" : "Unreconcile"}
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" onClick={onClear} title="Clear selection">
        <X className="size-4" />
      </Button>
    </div>
  );
}

// ── Summary strip ────────────────────────────────────────────────────────────

function BillPaymentsSummaryStrip({
  summary,
  loading,
  filtered,
}: {
  summary: ReturnType<typeof useBillPaymentsSummary>["data"];
  loading: boolean;
  filtered: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryStat
        label={filtered ? "Total paid · filtered" : "Total paid · 12mo"}
        value={loading ? null : formatMoney(summary?.totalAmount ?? 0)}
        helper={`${summary?.count ?? 0} payment${(summary?.count ?? 0) === 1 ? "" : "s"}`}
      />
      <SummaryStat
        label="Average payment"
        value={
          loading
            ? null
            : summary && summary.count > 0
              ? formatMoney(summary.totalAmount / summary.count)
              : "—"
        }
        helper="In the current view"
      />
      <SummaryStat
        label="Top method"
        value={
          loading
            ? null
            : (() => {
                const top = (summary?.byMethod ?? [])
                  .slice()
                  .sort((a, b) => b.amount - a.amount)[0];
                return top ? METHOD_LABELS[top.method] : "—";
              })()
        }
        helper={(() => {
          const top = (summary?.byMethod ?? [])
            .slice()
            .sort((a, b) => b.amount - a.amount)[0];
          return top ? formatMoney(top.amount) : "No payments";
        })()}
      />
      <SummaryStat
        label="Methods used"
        value={loading ? null : String(summary?.byMethod.length ?? 0)}
        helper={
          (summary?.byMethod ?? [])
            .map(m => METHOD_LABELS[m.method])
            .slice(0, 3)
            .join(" · ") || "—"
        }
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode | null;
  helper: string;
}) {
  return (
    <Card className="px-4 py-3 shadow-none">
      <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-medium tabular-nums tracking-tight text-ink">
        {value === null ? <Skeleton className="h-6 w-24" /> : value}
      </div>
      <div className="mt-1 truncate text-[11px] text-subtle">{helper}</div>
    </Card>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function BillPaymentsFilterBar({
  filters,
  onChangeMethod,
  onChangeDateFrom,
  onChangeDateTo,
  onChangeReconciled,
  onClear,
  anyActive,
}: {
  filters: BillPaymentFilters;
  onChangeMethod: (value: string) => void;
  onChangeDateFrom: (value: string) => void;
  onChangeDateTo: (value: string) => void;
  onChangeReconciled: (value: "all" | "reconciled" | "unreconciled") => void;
  onClear: () => void;
  anyActive: boolean;
}) {
  const currentReconciled = filters.reconciled ?? "unreconciled";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-card px-3 py-2.5">
      <FilterField label="Status">
        <Select
          value={currentReconciled}
          onValueChange={v =>
            onChangeReconciled(v as "all" | "reconciled" | "unreconciled")
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECONCILED_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Method">
        <Select value={filters.method ?? "all"} onValueChange={onChangeMethod}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="From">
        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={e => onChangeDateFrom(e.target.value)}
          className="h-8 w-[140px] text-xs"
        />
      </FilterField>

      <FilterField label="To">
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={e => onChangeDateTo(e.target.value)}
          className="h-8 w-[140px] text-xs"
        />
      </FilterField>

      {anyActive ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs font-medium text-subtle underline-offset-4 hover:text-ink hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-subtle">
      <span className="font-medium uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
