export type SupplierInvoicePaymentStatus = "unpaid" | "partial" | "paid";

export type SupplierInvoicePaymentSummary = {
  totalAmount: string;
  totalPaid: string;
  balanceDue: string;
  paymentStatus: SupplierInvoicePaymentStatus;
};

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
