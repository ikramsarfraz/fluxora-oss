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

// "use server" files can only export async functions, so re-exports
// via `export { x } from "./y"` are rejected by the Next.js compiler.
// Inline async wrappers around the attachment + status actions keep
// the barrel's import surface intact for hooks + components.
import {
  getExpenseAttachmentDownloadUrlAction as _getExpenseAttachmentDownloadUrlAction,
  listExpenseAttachmentsAction as _listExpenseAttachmentsAction,
  removeExpenseAttachmentAction as _removeExpenseAttachmentAction,
  uploadExpenseAttachmentAction as _uploadExpenseAttachmentAction,
} from "./attachments";

import {
  approveExpenseAction as _approveExpenseAction,
  markExpensePaidAction as _markExpensePaidAction,
  rejectExpenseAction as _rejectExpenseAction,
  resetExpenseToDraftAction as _resetExpenseToDraftAction,
  submitExpenseAction as _submitExpenseAction,
} from "./status";

export async function getExpenseAttachmentDownloadUrlAction(
  ...args: Parameters<typeof _getExpenseAttachmentDownloadUrlAction>
) {
  return _getExpenseAttachmentDownloadUrlAction(...args);
}

export async function listExpenseAttachmentsAction(
  ...args: Parameters<typeof _listExpenseAttachmentsAction>
) {
  return _listExpenseAttachmentsAction(...args);
}

export async function removeExpenseAttachmentAction(
  ...args: Parameters<typeof _removeExpenseAttachmentAction>
) {
  return _removeExpenseAttachmentAction(...args);
}

export async function uploadExpenseAttachmentAction(
  ...args: Parameters<typeof _uploadExpenseAttachmentAction>
) {
  return _uploadExpenseAttachmentAction(...args);
}

export async function approveExpenseAction(
  ...args: Parameters<typeof _approveExpenseAction>
) {
  return _approveExpenseAction(...args);
}

export async function markExpensePaidAction(
  ...args: Parameters<typeof _markExpensePaidAction>
) {
  return _markExpensePaidAction(...args);
}

export async function rejectExpenseAction(
  ...args: Parameters<typeof _rejectExpenseAction>
) {
  return _rejectExpenseAction(...args);
}

export async function resetExpenseToDraftAction(
  ...args: Parameters<typeof _resetExpenseToDraftAction>
) {
  return _resetExpenseToDraftAction(...args);
}

export async function submitExpenseAction(
  ...args: Parameters<typeof _submitExpenseAction>
) {
  return _submitExpenseAction(...args);
}

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
