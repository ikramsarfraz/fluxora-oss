/**
 * Single source of truth for the payment-method enum + the labeled options
 * the dialogs render in `<Select>` dropdowns. Previously this lived inline
 * in 9 components (customer + supplier payment entry, bulk payment, edit
 * dialogs, etc.) which made it easy for a new method or a relabel to drift
 * between surfaces.
 *
 * Values match the `payment_method` Postgres enum (see db/schema.ts) — the
 * AR `payments.payment_method` and AP `supplier_invoice_payments.payment_method`
 * columns both reference it. Adding a method requires both a migration and
 * an entry here.
 */

export const PAYMENT_METHODS = [
  "cash",
  "check",
  "ach",
  "zelle",
  "credit_card",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

/**
 * Ordered list for select dropdowns. Order is chosen to surface the most
 * common ERP payment methods first (cash/check/ACH at the top); change
 * with care, every dialog inherits this ordering.
 */
export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}> = PAYMENT_METHODS.map(value => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
