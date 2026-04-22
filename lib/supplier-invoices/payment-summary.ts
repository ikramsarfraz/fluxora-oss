/**
 * Pure helpers for supplier-invoice payment math. Kept in `lib/` (not
 * `services/`) so client components can import them without transitively
 * pulling `next/headers` via the auth helpers.
 */

export type SupplierInvoicePaymentStatus = "unpaid" | "partial" | "paid";

export type SupplierInvoicePaymentSummary = {
  totalAmount: string;
  totalPaid: string;
  balanceDue: string;
  paymentStatus: SupplierInvoicePaymentStatus;
};

/**
 * Derive payment totals + status from an invoice's raw totalAmount and its
 * payments array. Uses `.toFixed(2)` string math so UI can render directly
 * without reintroducing money rounding bugs.
 *
 * Thresholds:
 *   - balanceDue <= 0.005 → "paid"
 *   - no payments at all  → "unpaid"
 *   - anything in between → "partial"
 */
export function computePaymentSummary(invoice: {
  totalAmount: string | number;
  payments: Array<{ amount: string | number }>;
}): SupplierInvoicePaymentSummary {
  const total = Number(invoice.totalAmount) || 0;
  const totalPaid = invoice.payments.reduce(
    (acc, p) => acc + (Number(p.amount) || 0),
    0,
  );
  const balanceDue = Math.max(0, total - totalPaid);

  let paymentStatus: SupplierInvoicePaymentStatus;
  if (balanceDue <= 0.005) {
    paymentStatus = "paid";
  } else if (totalPaid <= 0.005) {
    paymentStatus = "unpaid";
  } else {
    paymentStatus = "partial";
  }

  return {
    totalAmount: total.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    balanceDue: balanceDue.toFixed(2),
    paymentStatus,
  };
}
