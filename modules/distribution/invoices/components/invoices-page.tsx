"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { ListingPage, StatusPill, MonoText, type ListingColumn } from "@/components/listing-page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesInvoicesPage, useSalesInvoicesSummary } from "../hooks/use-invoices";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type {
  SalesInvoiceFilters,
  SalesInvoiceListItem,
  SalesInvoiceListSort,
  SalesInvoiceStatusFilter,
} from "../services/invoicing";

type InvoiceRow = SalesInvoiceListItem;

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--color-divider)", color: "var(--color-subtle)" },
  sent: { label: "Sent", bg: "var(--color-info-bg)", color: "var(--color-info-fg)" },
  partially_paid: { label: "Partially paid", bg: "var(--color-warning-bg)", color: "var(--color-warning-fg)" },
  paid: { label: "Paid", bg: "var(--color-success-bg)", color: "var(--color-success-fg)" },
  void: { label: "Void", bg: "var(--color-danger-bg)", color: "var(--color-danger-fg)" },
};

const COLUMNS: ListingColumn<InvoiceRow>[] = [
  {
    key: "invoiceNumber",
    header: "Invoice #",
    sortKey: "invoiceNumber",
    width: "130px",
    render: row => ({
      primary: (
        <Link href={`/invoices/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.invoiceNumber}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "customer",
    header: "Customer",
    render: row => ({
      primary: row.customer
        ? <span style={{ fontWeight: 500 }}>{row.customer.name}</span>
        : <span style={{ color: "var(--color-subtle)" }}>—</span>,
    }),
  },
  {
    key: "status",
    header: "Status",
    render: row => {
      const pill = STATUS_PILL[row.status] ?? { label: row.status, bg: "var(--color-divider)", color: "var(--color-subtle)" };
      return { primary: <StatusPill label={pill.label} bg={pill.bg} color={pill.color} /> };
    },
  },
  {
    key: "invoiceDate",
    header: "Invoice date",
    sortKey: "invoiceDate",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.invoiceDate)}</MonoText> }),
  },
  {
    key: "dueDate",
    header: "Due",
    render: row =>
      row.dueDate
        ? { primary: <MonoText>{formatDisplayDate(row.dueDate)}</MonoText> }
        : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> },
  },
  {
    key: "totalAmount",
    header: "Total",
    align: "right",
    render: row => ({ primary: <MonoText>{formatMoney(row.totalAmount)}</MonoText> }),
  },
  {
    key: "balanceDue",
    header: "Balance due",
    align: "right",
    render: row => {
      const balance = Number(row.balanceDue);
      return {
        primary: (
          <span style={{ fontWeight: balance > 0 ? 500 : 400, color: balance > 0 ? "var(--color-ink)" : "var(--color-subtle)" }}>
            <MonoText>{formatMoney(row.balanceDue)}</MonoText>
          </span>
        ),
      };
    },
  },
];

const STATUS_OPTIONS: Array<{ value: SalesInvoiceStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent (open)" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default function Invoices() {
  const router = useRouter();

  const pagination = useUrlPaginationState<SalesInvoiceListSort, SalesInvoiceFilters>({
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: { status: undefined, dateFrom: undefined, dateTo: undefined },
  });

  const filtersForQuery: SalesInvoiceFilters = {
    status: pagination.filters.status,
    dateFrom: pagination.filters.dateFrom,
    dateTo: pagination.filters.dateTo,
  };

  const { data, isLoading, isFetching, error, refetch } = useSalesInvoicesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: filtersForQuery,
  });

  const { data: summary, isLoading: summaryLoading } = useSalesInvoicesSummary(
    filtersForQuery,
    pagination.search,
  );

  if (error) {
    return (
      <div style={{ padding: 24, color: "var(--color-danger-fg)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button type="button" onClick={() => refetch()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    (pagination.filters.status && pagination.filters.status !== "all") ||
      pagination.filters.dateFrom ||
      pagination.filters.dateTo,
  );

  return (
    <div className="flex flex-col gap-4">
      <InvoicesSummaryStrip
        summary={summary}
        loading={summaryLoading}
        filtered={hasActiveFilters || Boolean(pagination.search)}
      />

      <InvoicesFilterBar
        filters={pagination.filters}
        onChangeStatus={value =>
          pagination.setFilter(
            "status",
            value === "all" ? undefined : (value as SalesInvoiceStatusFilter),
          )
        }
        onChangeDateFrom={value => pagination.setFilter("dateFrom", value || undefined)}
        onChangeDateTo={value => pagination.setFilter("dateTo", value || undefined)}
        onClear={() =>
          pagination.setFilters({
            status: undefined,
            dateFrom: undefined,
            dateTo: undefined,
          })
        }
        anyActive={hasActiveFilters}
      />

      <ListingPage
        title="Invoices"
        subtitle="Review customer invoices generated from fulfilled sales orders."
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/invoices/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/invoices/${row.id}` },
          { label: "View order", href: row => `/orders/${row.salesOrderId}` },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search invoices, customers…"
        emptyTitle={
          hasActiveFilters || pagination.search
            ? "No invoices match these filters"
            : "No invoices yet"
        }
        emptyDescription={
          hasActiveFilters || pagination.search
            ? "Try clearing the filters above or widening the date range."
            : "Invoices are generated when sales orders are fulfilled."
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
        onSortChange={(key, dir) => pagination.setSort(key as SalesInvoiceListSort, dir)}
      />
    </div>
  );
}

// ── Summary strip ────────────────────────────────────────────────────────────

function InvoicesSummaryStrip({
  summary,
  loading,
  filtered,
}: {
  summary: ReturnType<typeof useSalesInvoicesSummary>["data"];
  loading: boolean;
  filtered: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryStat
        label={filtered ? "Invoices · filtered" : "Invoices · all time"}
        value={loading ? null : String(summary?.invoiceCount ?? 0)}
        helper={`${summary?.openCount ?? 0} open · ${formatMoney(summary?.totalAmount ?? 0)} billed`}
      />
      <SummaryStat
        label="Open balance"
        value={loading ? null : formatMoney(summary?.totalOpenBalance ?? 0)}
        helper={`${summary?.openCount ?? 0} unpaid invoice${(summary?.openCount ?? 0) === 1 ? "" : "s"}`}
        tone={
          (summary?.totalOpenBalance ?? 0) > 0 ? "warning" : "default"
        }
      />
      <SummaryStat
        label="Overdue"
        value={loading ? null : formatMoney(summary?.overdueAmount ?? 0)}
        helper={`${summary?.overdueCount ?? 0} overdue invoice${(summary?.overdueCount ?? 0) === 1 ? "" : "s"}`}
        tone={(summary?.overdueCount ?? 0) > 0 ? "danger" : "default"}
      />
      <SummaryStat
        label="Average invoice"
        value={
          loading
            ? null
            : summary && summary.invoiceCount > 0
              ? formatMoney(summary.totalAmount / summary.invoiceCount)
              : "—"
        }
        helper="In the current view"
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode | null;
  helper: string;
  tone?: "default" | "warning" | "danger";
}) {
  const valueColor =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning-fg"
        : "text-ink";
  return (
    <Card className="px-4 py-3 shadow-none">
      <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl font-medium tabular-nums tracking-tight ${valueColor}`}>
        {value === null ? <Skeleton className="h-6 w-24" /> : value}
      </div>
      <div className="mt-1 text-[11px] text-subtle truncate">{helper}</div>
    </Card>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function InvoicesFilterBar({
  filters,
  onChangeStatus,
  onChangeDateFrom,
  onChangeDateTo,
  onClear,
  anyActive,
}: {
  filters: SalesInvoiceFilters;
  onChangeStatus: (value: string) => void;
  onChangeDateFrom: (value: string) => void;
  onChangeDateTo: (value: string) => void;
  onClear: () => void;
  anyActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-card px-3 py-2.5">
      <FilterField label="Status">
        <Select value={filters.status ?? "all"} onValueChange={onChangeStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
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
