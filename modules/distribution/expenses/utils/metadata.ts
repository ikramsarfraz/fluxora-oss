import type { PortalUserRole } from "@/lib/auth/permissions";

export const EXPENSE_CATEGORIES = [
  { value: "fleet_maintenance", label: "Fleet maintenance" },
  { value: "gas", label: "Gas" },
  { value: "rent", label: "Rent" },
  { value: "insurance", label: "Insurance" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Supplies" },
  { value: "payroll", label: "Payroll" },
  { value: "other", label: "Other" },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];

export const EXPENSE_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
] as const;

export type ExpensePaymentMethod =
  (typeof EXPENSE_PAYMENT_METHODS)[number]["value"];

export function expenseCategoryLabel(value: string): string {
  const found = EXPENSE_CATEGORIES.find(c => c.value === value);
  return found?.label ?? value;
}

export function expensePaymentMethodLabel(
  value: ExpensePaymentMethod | null | undefined,
): string {
  if (!value) return "—";
  const found = EXPENSE_PAYMENT_METHODS.find(m => m.value === value);
  return found?.label ?? value;
}

const EXPENSE_MUTATION_ROLES: readonly PortalUserRole[] = [
  "owner",
  "admin",
  "accounting",
];

export function canManageExpenses(
  role: PortalUserRole | null | undefined,
): boolean {
  return !!role && EXPENSE_MUTATION_ROLES.includes(role);
}
