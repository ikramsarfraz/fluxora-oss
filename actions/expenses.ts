"use server";

import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "@/services/expenses";

export async function getExpensesAction() {
  return await getExpenses();
}

export async function getExpenseByIdAction(id: string) {
  return await getExpenseById(id);
}

export async function createExpenseAction(input: CreateExpenseInput) {
  return await createExpense(input);
}

export async function updateExpenseAction(input: UpdateExpenseInput) {
  return await updateExpense(input);
}

export async function deleteExpenseAction(id: string) {
  return await deleteExpense(id);
}
