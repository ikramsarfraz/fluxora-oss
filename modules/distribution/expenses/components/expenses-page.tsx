"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListingAction, ListingErrorState, ListingPage, ListingSecondaryAction, MonoText, StatusPill, type ListingColumn } from "@/components/listing-page";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { exportExpensesCsvAction } from "../actions";
import { useDeleteExpense, useExpensesPage } from "../hooks/use-expenses";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import {
  EXPENSE_PAYMENT_METHODS,
  canManageExpenses,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  expenseRecurrenceLabel,
} from "@/lib/expenses/metadata";
import {
  EXPENSE_STATUSES,
  expenseStatusLabel,
  expenseStatusPill,
} from "../utils/expense-status";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  ExpenseListFilters,
  ExpenseListItem,
  ExpenseListSort,
} from "../services/expenses";

type ExpenseRow = ExpenseListItem;

const COLUMNS: ListingColumn<ExpenseRow>[] = [
  {
    key: "expenseDate",
    header: "Date",
    sortKey: "expenseDate",
    render: row => ({
      primary: (
        <Link href={`/expenses/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{formatDisplayDate(row.expenseDate)}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "description",
    header: "Description",
    render: row => {
      const isSchedule =
        row.recurrenceInterval != null && row.recurrenceInterval !== "none";
      const isInstance = row.recurrenceParentId != null;
      return {
        primary: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            {row.note ? row.note : <span style={{ color: "var(--color-subtle)" }}>—</span>}
            {isSchedule ? (
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 100,
                  background: "oklch(96% 0.04 70)",
                  color: "oklch(50% 0.14 70)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
                title={`Repeats ${expenseRecurrenceLabel(row.recurrenceInterval).toLowerCase()}`}
              >
                Recurring
              </span>
            ) : null}
            {isInstance && !isSchedule ? (
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 100,
                  background: "var(--color-divider)",
                  color: "var(--color-subtle)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
                title="Auto-generated from a recurring schedule"
              >
                Auto
              </span>
            ) : null}
          </span>
        ),
        secondary: expenseCategoryLabel(row.category),
      };
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
          }}
        >
          {expensePaymentMethodLabel(row.paymentMethod) ?? "—"}
        </span>
      ),
    }),
  },
  {
    key: "status",
    header: "Status",
    render: row => {
      const pill = expenseStatusPill(row.status);
      return {
        primary: <StatusPill label={pill.label} bg={pill.bg} color={pill.color} />,
      };
    },
  },
  {
    key: "recordedBy",
    header: "Recorded by",
    render: row => ({
      primary: row.createdBy?.fullName ?? <span style={{ color: "var(--color-subtle)" }}>—</span>,
    }),
  },
];

export function ExpensesPage() {
  const router = useRouter();
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: currentUser } = useCurrentPortalUser();
  const canManage = canManageExpenses(currentUser?.role);

  const pagination = useUrlPaginationState<ExpenseListSort, ExpenseListFilters>({
    defaultSort: "expenseDate",
    defaultDirection: "desc",
    defaultFilters: {
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
      paymentMethod: "",
      recurrence: "",
      status: "",
    },
  });
  const f = pagination.filters;
  const hasActiveFilter = Boolean(
    f.dateFrom || f.dateTo || f.amountMin || f.amountMax || f.paymentMethod || f.recurrence || f.status,
  );

  const { data, isLoading, isFetching, error, refetch } = useExpensesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: f,
  });

  const deleteExpense = useDeleteExpense();

  async function handleExportCsv() {
    setExporting(true);
    try {
      const result = await exportExpensesCsvAction({
        search: pagination.search,
        sort: pagination.sort,
        direction: pagination.direction,
        filters: f,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        result.count === 0
          ? "Exported 0 expenses."
          : `Exported ${result.count} expense${result.count === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <ListingErrorState
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <FilterBar
        filters={f}
        onChange={(key, value) => pagination.setFilter(key, value)}
        onClear={() =>
          pagination.setFilters({
            dateFrom: "",
            dateTo: "",
            amountMin: "",
            amountMax: "",
            paymentMethod: "",
            recurrence: "",
            status: "",
          })
        }
        hasActiveFilter={hasActiveFilter}
      />
      <ListingPage
        title="Expenses"
        subtitle="Track operational costs and business expenditures."
        secondaryActions={
          <ListingSecondaryAction onClick={handleExportCsv} disabled={exporting}>
            <Download className="size-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </ListingSecondaryAction>
        }
        primaryAction={
          canManage
            ? (
              <ListingAction href="/expenses/new">
                <Plus className="size-3.5" />
                Add expense
              </ListingAction>
            )
            : undefined
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/expenses/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/expenses/${row.id}` },
          ...(canManage
            ? [{ label: "Void", variant: "destructive" as const, onClick: (row: ExpenseRow) => setDeletingExpense(row) }]
            : []),
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search expenses, vendors…"
        emptyTitle="No expenses yet"
        emptyDescription="Record your first business expense."
        emptyAction={
          canManage
            ? (
              <ListingAction href="/expenses/new">
                <Plus className="size-3.5" />
                Add expense
              </ListingAction>
            )
            : undefined
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
        onSortChange={(key, dir) => pagination.setSort(key as ExpenseListSort, dir)}
      />

      <AlertDialog open={!!deletingExpense} onOpenChange={open => { if (!open) setDeletingExpense(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void expense</AlertDialogTitle>
            <AlertDialogDescription>
              Void this expense? It will be hidden from the listing and any
              recurring schedule stops materializing future instances. The row
              is kept for audit and can be restored from the voided-expenses
              view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingExpense) return;
                deleteExpense.mutate(deletingExpense.id, {
                  onSuccess: () => toast.success("Expense voided."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingExpense(null);
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// shadcn Select disallows value="" (collides with the placeholder slot),
// so the "All" / "Any" entry rides a sentinel and we map at the boundary.
const ALL_SENTINEL = "__all__";

function FilterBar({
  filters,
  onChange,
  onClear,
  hasActiveFilter,
}: {
  filters: ExpenseListFilters;
  onChange: <K extends keyof ExpenseListFilters>(
    key: K,
    value: ExpenseListFilters[K],
  ) => void;
  onClear: () => void;
  hasActiveFilter: boolean;
}) {
  const triggerClass = "h-8 w-[150px] border-border-default bg-card text-[13px] text-ink shadow-none";
  const inputClass = "h-8 border-border-default bg-card text-[13px] shadow-none";
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2.5">
      <Field label="Date from">
        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={e => onChange("dateFrom", e.target.value)}
          aria-label="Filter by start date"
          className={`${inputClass} w-[150px]`}
        />
      </Field>
      <Field label="Date to">
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={e => onChange("dateTo", e.target.value)}
          aria-label="Filter by end date"
          className={`${inputClass} w-[150px]`}
        />
      </Field>
      <Field label="Min amount">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="0.00"
          value={filters.amountMin ?? ""}
          onChange={e => onChange("amountMin", e.target.value)}
          aria-label="Filter by minimum amount"
          className={`${inputClass} w-[110px]`}
        />
      </Field>
      <Field label="Max amount">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="0.00"
          value={filters.amountMax ?? ""}
          onChange={e => onChange("amountMax", e.target.value)}
          aria-label="Filter by maximum amount"
          className={`${inputClass} w-[110px]`}
        />
      </Field>
      <Field label="Method">
        <Select
          value={filters.paymentMethod ? filters.paymentMethod : ALL_SENTINEL}
          onValueChange={v => onChange("paymentMethod", v === ALL_SENTINEL ? "" : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filter by payment method"
            className={triggerClass}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Any</SelectItem>
            {EXPENSE_PAYMENT_METHODS.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Type">
        <Select
          value={filters.recurrence ? filters.recurrence : ALL_SENTINEL}
          onValueChange={v => onChange("recurrence", v === ALL_SENTINEL ? "" : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filter by recurrence type"
            className={triggerClass}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All</SelectItem>
            <SelectItem value="oneoff">One-off</SelectItem>
            <SelectItem value="schedules">Schedules</SelectItem>
            <SelectItem value="instances">Auto-generated</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status">
        <Select
          value={filters.status ? filters.status : ALL_SENTINEL}
          onValueChange={v => onChange("status", v === ALL_SENTINEL ? "" : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filter by approval status"
            className={triggerClass}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All</SelectItem>
            {EXPENSE_STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {expenseStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {hasActiveFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          className="h-8 px-3 text-xs"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
