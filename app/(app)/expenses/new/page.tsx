import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { canManageExpenses } from "@/services/expenses";
import { getCurrentPortalUser } from "@/services/portal-users";

import { ExpenseForm } from "../components/expense-form";

export default async function NewExpenseRoute() {
  const currentUser = await getCurrentPortalUser();
  if (!canManageExpenses(currentUser.role)) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="New expense"
        description="Record an operating expense."
      />
      <ExpenseForm mode="create" />
    </section>
  );
}
