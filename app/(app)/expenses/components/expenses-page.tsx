"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import {
  useDeleteExpense,
  useExpenses,
} from "@/hooks/use-expenses";
import { canManageExpenses } from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";

import { createExpenseColumns } from "./columns";
import { DataTable } from "./data-table";

export function ExpensesPage() {
  const { data, isLoading, error, refetch } = useExpenses();
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
    return <PageLoading message="Loading expenses..." />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const expenses = data ?? [];
  const hasExpenses = expenses.length > 0;
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
