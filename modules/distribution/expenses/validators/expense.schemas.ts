import { z } from "zod";

import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  type ExpenseCategoryValue,
  type ExpensePaymentMethod,
} from "@/lib/expenses/metadata";

const categoryValues = EXPENSE_CATEGORIES.map(c => c.value) as [
  ExpenseCategoryValue,
  ...ExpenseCategoryValue[],
];

const paymentMethodValues = EXPENSE_PAYMENT_METHODS.map(m => m.value) as [
  ExpensePaymentMethod,
  ...ExpensePaymentMethod[],
];

export const expenseFormSchema = z.object({
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
});

export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
export type ExpenseFormParsed = z.output<typeof expenseFormSchema>;
