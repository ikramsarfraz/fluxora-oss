import { z } from "zod";

import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_RECURRENCE_INTERVALS,
  type ExpenseCategoryValue,
  type ExpensePaymentMethod,
  type ExpenseRecurrenceInterval,
} from "@/lib/expenses/metadata";

const categoryValues = EXPENSE_CATEGORIES.map(c => c.value) as [
  ExpenseCategoryValue,
  ...ExpenseCategoryValue[],
];

const paymentMethodValues = EXPENSE_PAYMENT_METHODS.map(m => m.value) as [
  ExpensePaymentMethod,
  ...ExpensePaymentMethod[],
];

const recurrenceValues = EXPENSE_RECURRENCE_INTERVALS.map(r => r.value) as [
  ExpenseRecurrenceInterval,
  ...ExpenseRecurrenceInterval[],
];

export const expenseFormSchema = z
  .object({
    expenseDate: z
      .string()
      .min(1, "Expense date is required.")
      .refine(v => !Number.isNaN(new Date(v).getTime()), {
        message: "Invalid date.",
      }),
    category: z.enum(categoryValues, {
      message: "Select a category.",
    }),
    amount: z
      .string()
      .transform(s => (s ?? "").trim())
      .pipe(
        z
          .string()
          .min(1, "Amount is required.")
          .refine(
            v => {
              const n = Number(v);
              return Number.isFinite(n) && n >= 0;
            },
            { message: "Amount must be zero or greater." },
          ),
      ),
    paymentMethod: z
      .union([z.enum(paymentMethodValues), z.literal("")])
      .optional()
      .transform(v => (v === "" || v === undefined ? null : v)),
    note: z
      .string()
      .optional()
      .transform(v => {
        const trimmed = (v ?? "").trim();
        return trimmed ? trimmed : null;
      }),
    recurrenceInterval: z
      .enum(recurrenceValues)
      .optional()
      .transform(v => v ?? "none"),
    recurrenceEndDate: z
      .string()
      .optional()
      .transform(v => {
        const trimmed = (v ?? "").trim();
        return trimmed === "" ? null : trimmed;
      })
      .refine(v => v == null || !Number.isNaN(new Date(v).getTime()), {
        message: "Invalid end date.",
      }),
  })
  .refine(
    data =>
      data.recurrenceInterval === "none" ||
      data.recurrenceEndDate == null ||
      new Date(data.recurrenceEndDate) >= new Date(data.expenseDate),
    {
      message: "End date must be on or after the start date.",
      path: ["recurrenceEndDate"],
    },
  );

export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
export type ExpenseFormParsed = z.output<typeof expenseFormSchema>;
