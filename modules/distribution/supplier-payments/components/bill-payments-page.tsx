"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const COLUMNS: ListingColumn<BillPaymentRow>[] = [
  {
    key: "paymentDate",
    header: "Date",
    sortKey: "paymentDate",
    render: row => ({
      primary: (
        <Link
          href={`/bill-payments/${row.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
          onClick={e => e.stopPropagation()}
        >
          <MonoText>{formatDisplayDate(row.paymentDate)}</MonoText>
        </Link>
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
      const ref = row.reference;
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

export function BillPaymentsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecordPayment = can(currentUser?.role, "record_supplier_payment");
  const [recordOpen, setRecordOpen] = useState(false);

  const pagination = useUrlPaginationState<BillPaymentListSort, BillPaymentFilters>({
    defaultSort: "paymentDate",
    defaultDirection: "desc",
    defaultFilters: { method: undefined, dateFrom: undefined, dateTo: undefined },
  });

  const filtersForQuery: BillPaymentFilters = {
    method: pagination.filters.method,
    dateFrom: pagination.filters.dateFrom,
    dateTo: pagination.filters.dateTo,
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

  if (error) {
    return (
      <div style={{ padding: 24, color: "var(--color-danger-fg)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            textDecoration: "underline",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    pagination.filters.method ||
      pagination.filters.dateFrom ||
      pagination.filters.dateTo,
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
        onClear={() =>
          pagination.setFilters({
            method: undefined,
            dateFrom: undefined,
            dateTo: undefined,
          })
        }
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
        columns={COLUMNS}
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
  onClear,
  anyActive,
}: {
  filters: BillPaymentFilters;
  onChangeMethod: (value: string) => void;
  onChangeDateFrom: (value: string) => void;
  onChangeDateTo: (value: string) => void;
  onClear: () => void;
  anyActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-card px-3 py-2.5">
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
