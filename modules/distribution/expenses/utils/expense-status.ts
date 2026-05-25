/**
 * Expense approval state machine.
 *
 * Mirrors the expense_status enum in db/schema. Service code enforces
 * transitions at write time; the matrix here is the single source of
 * truth for legal moves (used by the service AND the UI to disable
 * buttons that don't apply to the current state).
 *
 * Transitions:
 *
 *   draft     --submit--->   submitted
 *   submitted --approve-->   approved
 *   submitted --reject--->   rejected
 *   rejected  --reset---->   draft
 *   approved  --mark_paid--> paid
 *
 * Notes:
 *   - 'reject' carries a reason (passed separately); the rest are no-arg.
 *   - 'paid' is terminal — no transitions out. A correction means a new
 *     expense, not a reverse-paid.
 *   - 'rejected' → 'draft' is a 'reset', not a re-submit, so the creator
 *     can edit before re-submitting.
 */

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid";

export type ExpenseStatusTransition =
  | "submit"
  | "approve"
  | "reject"
  | "reset"
  | "mark_paid";

const TRANSITIONS: Record<ExpenseStatusTransition, { from: ExpenseStatus; to: ExpenseStatus }> = {
  submit: { from: "draft", to: "submitted" },
  approve: { from: "submitted", to: "approved" },
  reject: { from: "submitted", to: "rejected" },
  reset: { from: "rejected", to: "draft" },
  mark_paid: { from: "approved", to: "paid" },
};

export function canTransition(
  currentStatus: ExpenseStatus,
  transition: ExpenseStatusTransition,
): boolean {
  return TRANSITIONS[transition]?.from === currentStatus;
}

export function nextStatus(transition: ExpenseStatusTransition): ExpenseStatus {
  return TRANSITIONS[transition].to;
}

export const EXPENSE_STATUSES: readonly ExpenseStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "paid",
];

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export function expenseStatusLabel(status: ExpenseStatus | string | null | undefined): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status as ExpenseStatus] ?? String(status);
}

/**
 * Tone hint for the UI badge — matches the design system's existing
 * neutral/info/success/warning/danger palette. Kept here so list, detail,
 * and any future approval-queue view all colour-code identically.
 */
export function expenseStatusTone(
  status: ExpenseStatus | string | null | undefined,
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "draft":
      return "neutral";
    case "submitted":
      return "info";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "paid":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Pill palette for the shared `StatusPill` primitive in
 * `@/components/listing-page`. Same { label, bg, color } shape as
 * STATUS_PILL maps in orders / supplier-invoices listings so the
 * visual language stays uniform across the app.
 */
export function expenseStatusPill(
  status: ExpenseStatus | string | null | undefined,
): { label: string; bg: string; color: string } {
  const label = expenseStatusLabel(status);
  switch (expenseStatusTone(status)) {
    case "info":
      return { label, bg: "var(--color-info-bg)", color: "var(--color-info-fg)" };
    case "success":
      return { label, bg: "var(--color-success-bg)", color: "var(--color-success-fg)" };
    case "danger":
      return { label, bg: "var(--color-danger-bg)", color: "var(--color-danger-fg)" };
    case "warning":
      return { label, bg: "var(--color-warning-bg)", color: "var(--color-warning-fg)" };
    default:
      return { label, bg: "var(--color-divider)", color: "var(--color-subtle)" };
  }
}
