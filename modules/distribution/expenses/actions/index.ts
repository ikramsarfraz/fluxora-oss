"use server";

import { serializeCsv } from "@/lib/csv/serialize";

import {
  createExpense,
  deleteExpense,
  exportExpensesCsv,
  getExpenseById,
  getExpenses,
  getExpensesPage,
  updateExpense,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "../services/expenses";

export {
  getExpenseAttachmentDownloadUrlAction,
  listExpenseAttachmentsAction,
  removeExpenseAttachmentAction,
  uploadExpenseAttachmentAction,
} from "./attachments";

export {
  approveExpenseAction,
  markExpensePaidAction,
  rejectExpenseAction,
  resetExpenseToDraftAction,
  submitExpenseAction,
} from "./status";

export async function getExpensesAction() {
  return await getExpenses();
}

export async function getExpensesPageAction(
  input?: Parameters<typeof getExpensesPage>[0],
) {
  return await getExpensesPage(input);
}

export async function exportExpensesCsvAction(
  input?: Parameters<typeof exportExpensesCsv>[0],
) {
  const rows = await exportExpensesCsv(input);
  const csv = serializeCsv(
    [
      { key: "expenseDate", label: "Expense date" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount" },
      { key: "paymentMethod", label: "Payment method" },
      { key: "note", label: "Note" },
      { key: "recurrenceInterval", label: "Recurrence" },
      { key: "recurrenceEndDate", label: "Recurrence end" },
      { key: "isRecurringSchedule", label: "Is schedule" },
      { key: "isMaterializedInstance", label: "Is auto-generated" },
      { key: "createdBy", label: "Created by" },
      { key: "createdAt", label: "Created at" },
    ],
    rows,
  );
  const today = new Date().toISOString().slice(0, 10);
  return { filename: `expenses-${today}.csv`, csv, count: rows.length };
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
