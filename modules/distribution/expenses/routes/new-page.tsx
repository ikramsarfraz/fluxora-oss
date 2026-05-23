import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { canManageExpenses } from "../services/expenses";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { ExpenseForm } from "../components/expense-form";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    amount?: string;
    note?: string;
  }>;
}) {
  const currentUser = await getCurrentPortalUser();
  if (!canManageExpenses(currentUser.role)) {
    notFound();
  }

  const params = await searchParams;
  // Sanitize: only forward values that pass a basic shape check. Anything
  // weird (oversize, malformed) falls back to the form's normal defaults.
  const isIsoDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date);
  const parsedAmount =
    typeof params.amount === "string" ? Number(params.amount) : NaN;
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0;
  const prefill =
    isIsoDate || isValidAmount || params.note
      ? {
          expenseDate: isIsoDate ? params.date : undefined,
          amount: isValidAmount ? Math.abs(parsedAmount).toFixed(2) : undefined,
          note: params.note?.slice(0, 500),
        }
      : undefined;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="New expense"
        description={
          prefill
            ? "Pre-filled from a bank transaction — review and save."
            : "Record an operating expense."
        }
      />
      <ExpenseForm mode="create" prefill={prefill} />
    </section>
  );
}
