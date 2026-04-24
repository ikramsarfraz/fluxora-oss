"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import {
  useDeleteExpense,
  useExpensesPage,
} from "@/hooks/use-expenses";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { canManageExpenses } from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";
import type { ExpenseListSort } from "@/services/expenses";

import { createExpenseColumns } from "./columns";
import { DataTable } from "./data-table";

export function ExpensesPage() {
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
  const { data: currentUser } = useCurrentPortalUser();
  const deleteExpense = useDeleteExpense();

  const canManage = canManageExpenses(currentUser?.role);
  const manageDisabledReason = canManage
    ? undefined
    : "Your role does not allow managing expenses.";

  const columns = useMemo(
    () =>
      createExpenseColumns({
        canManage,
        manageDisabledReason,
        onDelete: expense => {
          deleteExpense.mutate(expense.id, {
            onSuccess: () => toast.success("Expense deleted."),
            onError: (e: Error) => toast.error(e.message),
          });
        },
      }),
    [canManage, manageDisabledReason, deleteExpense],
  );

  if (isLoading) {
    return <ListPageSkeleton tableColumns={6} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const expenses = data?.data ?? [];
  const hasExpenses =
    (data?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;
  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="expenses-heading">
      <PageHeader
        title="Expenses"
        description={
          hasExpenses
            ? `${expenses.length} expenses, totaling ${formatMoney(total)}.`
            : "Track day-to-day operating expenses."
        }
      >
        {canManage ? (
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New expense</span>
            </Link>
          </Button>
        ) : (
          <Button disabled title={manageDisabledReason}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New expense</span>
          </Button>
        )}
      </PageHeader>

      {hasExpenses ? (
        <DataTable
          columns={columns}
          data={expenses}
          searchPlaceholder="Search by category, notes..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={data?.page ?? pagination.page}
          pageSize={data?.pageSize ?? pagination.pageSize}
          total={data?.total ?? 0}
          pageCount={data?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as ExpenseListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Record your first operating expense to start tracking spend."
        >
          {canManage ? (
            <Button asChild>
              <Link href="/expenses/new">
                <Plus className="size-4" />
                New expense
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      )}
    </section>
  );
}
