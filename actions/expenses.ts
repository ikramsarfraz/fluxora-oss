"use server";

import {
  createExpenseAction as createExpenseActionImpl,
  deleteExpenseAction as deleteExpenseActionImpl,
  getExpenseByIdAction as getExpenseByIdActionImpl,
  getExpensesAction as getExpensesActionImpl,
  getExpensesPageAction as getExpensesPageActionImpl,
  updateExpenseAction as updateExpenseActionImpl,
} from "@/modules/distribution/expenses/actions";

export async function getExpensesAction() {
  return getExpensesActionImpl();
}

export async function getExpensesPageAction(
  ...args: Parameters<typeof getExpensesPageActionImpl>
) {
  return getExpensesPageActionImpl(...args);
}

export async function getExpenseByIdAction(
  ...args: Parameters<typeof getExpenseByIdActionImpl>
) {
  return getExpenseByIdActionImpl(...args);
}

export async function createExpenseAction(
  ...args: Parameters<typeof createExpenseActionImpl>
) {
  return createExpenseActionImpl(...args);
}

export async function updateExpenseAction(
  ...args: Parameters<typeof updateExpenseActionImpl>
) {
  return updateExpenseActionImpl(...args);
}

export async function deleteExpenseAction(
  ...args: Parameters<typeof deleteExpenseActionImpl>
) {
  return deleteExpenseActionImpl(...args);
}
