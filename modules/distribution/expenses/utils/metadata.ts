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

export const EXPENSE_RECURRENCE_INTERVALS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
] as const;

export type ExpenseRecurrenceInterval =
  (typeof EXPENSE_RECURRENCE_INTERVALS)[number]["value"];

export function expenseRecurrenceLabel(
  value: ExpenseRecurrenceInterval | null | undefined,
): string {
  if (!value || value === "none") return "Does not repeat";
  const found = EXPENSE_RECURRENCE_INTERVALS.find(r => r.value === value);
  return found?.label ?? value;
}

/**
 * Advance a date by one recurrence period. Returns an ISO date string (YYYY-MM-DD).
 * Same calendar day per period (e.g. monthly on the 31st rolls to the last day of months that lack it,
 * because JS Date.setMonth handles the overflow into the next month — which means we clamp explicitly).
 */
export function nextRecurrenceDate(
  fromDateISO: string,
  interval: ExpenseRecurrenceInterval,
): string {
  if (interval === "none") return fromDateISO;
  const [y, m, d] = fromDateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  switch (interval) {
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case "monthly":
      addCalendarMonths(date, 1);
      break;
    case "quarterly":
      addCalendarMonths(date, 3);
      break;
    case "annually":
      addCalendarMonths(date, 12);
      break;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Plan the set of expense instances to materialize from a recurring schedule.
 *
 * Walks forward from `recurrenceNextDueDate` adding one interval each step
 * until the next computed date is past `today` or past `recurrenceEndDate`.
 * Capped by `options.cap` to bound a single run's blast radius.
 *
 * Returns the list of due dates to insert (one expense row per date), the
 * advanced `nextDueDate` to write back on the schedule, and `exhausted` —
 * `true` when the schedule has run past its end date and should be parked
 * with `recurrenceNextDueDate = null`.
 *
 * Pure function — no I/O. The cron caller is responsible for the inserts.
 */
export function planRecurringInstances(
  schedule: {
    recurrenceInterval: ExpenseRecurrenceInterval;
    recurrenceEndDate: string | null;
    recurrenceNextDueDate: string | null;
  },
  options: { today: string; cap: number },
): { dueDates: string[]; nextDueDate: string | null; exhausted: boolean } {
  if (
    schedule.recurrenceInterval === "none" ||
    schedule.recurrenceNextDueDate == null
  ) {
    return { dueDates: [], nextDueDate: schedule.recurrenceNextDueDate, exhausted: false };
  }

  const dueDates: string[] = [];
  let due: string | null = schedule.recurrenceNextDueDate;
  let safety = 0;

  while (
    due != null &&
    due <= options.today &&
    (schedule.recurrenceEndDate == null || due <= schedule.recurrenceEndDate) &&
    safety < options.cap
  ) {
    dueDates.push(due);
    safety += 1;
    due = nextRecurrenceDate(due, schedule.recurrenceInterval);
  }

  const exhausted =
    schedule.recurrenceEndDate != null &&
    (due == null || due > schedule.recurrenceEndDate);

  return {
    dueDates,
    nextDueDate: exhausted ? null : due,
    exhausted,
  };
}

/**
 * Add `months` to a UTC date, clamping the day-of-month so we don't roll into the next month
 * when the target month has fewer days (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
 */
function addCalendarMonths(date: Date, months: number) {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfMonth));
}

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
