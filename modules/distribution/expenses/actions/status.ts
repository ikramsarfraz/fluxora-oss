"use server";

import {
  approveExpense,
  markExpensePaid,
  rejectExpense,
  resetExpenseToDraft,
  submitExpense,
} from "../services/expense-status";
import { canManageExpenses } from "../utils/metadata";

import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

/**
 * Every transition shares the same role gate today: any user who can manage
 * expenses can submit, approve, reject, reset, or mark paid. Separation of
 * duties (the submitter can't self-approve) is enforced inside approveExpense.
 *
 * If a tenant later wants a 'submitter-only' role split, this is the layer
 * to fan it out — service stays single-purpose.
 */
async function requireExpenseManager() {
  const user = await getCurrentPortalUser();
  if (!canManageExpenses(user.role)) {
    throw new Error("Your role does not allow managing expense status.");
  }
  return user;
}

export async function submitExpenseAction(expenseId: string) {
  await requireExpenseManager();
  return submitExpense(expenseId);
}

export async function approveExpenseAction(expenseId: string) {
  await requireExpenseManager();
  return approveExpense(expenseId);
}

export async function rejectExpenseAction(input: { expenseId: string; reason: string }) {
  await requireExpenseManager();
  return rejectExpense(input);
}

export async function resetExpenseToDraftAction(expenseId: string) {
  await requireExpenseManager();
  return resetExpenseToDraft(expenseId);
}

export async function markExpensePaidAction(expenseId: string) {
  await requireExpenseManager();
  return markExpensePaid(expenseId);
}
