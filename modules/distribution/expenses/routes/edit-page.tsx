import { notFound } from "next/navigation";

import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PageHeader } from "@/components/page-header";
import { expenseCategoryLabel } from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";
import { isUuid } from "@/lib/utils/uuid";
import {
  canManageExpenses,
  getExpenseById,
} from "../services/expenses";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { ExpenseForm } from "../components/expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const currentUser = await getCurrentPortalUser();
  if (!canManageExpenses(currentUser.role)) {
    notFound();
  }

  const expense = await getExpenseById(id);
  if (!expense) notFound();

  return (
    <section className="flex flex-col gap-6">
      <BreadcrumbLabel
        href={`/expenses/${expense.id}`}
        label={`${expenseCategoryLabel(expense.category)} · ${formatMoney(expense.amount)}`}
      />
      <PageHeader
        title="Edit expense"
        description="Update this operating expense."
      />
      <ExpenseForm mode="edit" expense={expense} />
    </section>
  );
}
