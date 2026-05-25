"use server";

import { getLinkedBankTransactionForExpense } from "../services/expense-bank-link";

export async function getLinkedBankTransactionForExpenseAction(
  expenseId: string,
) {
  return getLinkedBankTransactionForExpense(expenseId);
}
