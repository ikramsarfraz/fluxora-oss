import { money, nonNegative, toMoneyString } from "@/lib/utils/money";

export type SupplierInvoicePaymentStatus = "unpaid" | "partial" | "paid";

export type SupplierInvoicePaymentSummary = {
  totalAmount: string;
  totalPaid: string;
  balanceDue: string;
  paymentStatus: SupplierInvoicePaymentStatus;
};

/**
 * Single source of truth for AP balance display. Sums every payment on a
 * supplier invoice and decides paid/partial/unpaid.
 *
 * The Number version padded the status thresholds with `<= 0.005` to
 * absorb FP drift on heavily partial-paid bills (10 payments of $33.33
 * against a $333.30 total used to leave the balance at 1e-13, which
 * Number rendered as "0.00" but stayed strictly > 0). Decimal sums are
 * exact, so the threshold collapses to a direct equality check.
 */
export function computePaymentSummary(invoice: {
  totalAmount: string | number;
  payments: Array<{ amount: string | number }>;
}): SupplierInvoicePaymentSummary {
  const total = money(invoice.totalAmount);
  const totalPaid = invoice.payments.reduce(
    (acc, p) => acc.plus(money(p.amount)),
    money(0),
  );
  const balanceDue = nonNegative(total.minus(totalPaid));

  let paymentStatus: SupplierInvoicePaymentStatus;
  if (balanceDue.lte(0)) {
    paymentStatus = "paid";
  } else if (totalPaid.lte(0)) {
    paymentStatus = "unpaid";
  } else {
    paymentStatus = "partial";
  }

  return {
    totalAmount: toMoneyString(total),
    totalPaid: toMoneyString(totalPaid),
    balanceDue: toMoneyString(balanceDue),
    paymentStatus,
  };
}
