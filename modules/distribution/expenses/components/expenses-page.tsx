"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
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
import { ListingAction, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useDeleteExpense, useExpensesPage } from "../hooks/use-expenses";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import {
  canManageExpenses,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  expenseRecurrenceLabel,
} from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { ExpenseListItem, ExpenseListSort } from "../services/expenses";

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

  const { data: currentUser } = useCurrentPortalUser();
  const canManage = canManageExpenses(currentUser?.role);

  const pagination = useUrlPaginationState<ExpenseListSort>({
    defaultSort: "expenseDate",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useExpensesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const deleteExpense = useDeleteExpense();

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

  return (
    <>
      <ListingPage
        title="Expenses"
        subtitle="Track operational costs and business expenditures."
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
            ? [{ label: "Delete", variant: "destructive" as const, onClick: (row: ExpenseRow) => setDeletingExpense(row) }]
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
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingExpense) return;
                deleteExpense.mutate(deletingExpense.id, {
                  onSuccess: () => toast.success("Expense deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingExpense(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
