import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { isUuid } from "@/lib/utils/uuid";
import {
  canManageExpenses,
  getExpenseById,
} from "@/services/expenses";
import { getCurrentPortalUser } from "@/services/portal-users";

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
      <PageHeader
        title="Edit expense"
        description="Update this operating expense."
      />
      <ExpenseForm mode="edit" expense={expense} />
    </section>
  );
}
