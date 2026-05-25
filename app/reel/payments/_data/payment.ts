export type OpenInvoice = {
  number: string;
  issueDate: string;
  ageDays: number;
  amount: number;
};

export const CUSTOMER = {
  name: "Lighthouse Cafe",
  abbreviation: "LCH",
  city: "San Francisco",
  state: "CA",
};

export const PAYMENT_AMOUNT = 4880;
export const PAYMENT_METHOD = "ACH · ending 0142";
export const PAYMENT_DATE = "May 19, 2026";

// Customer's open invoices, oldest first. Payment will FIFO-allocate.
export const OPEN_INVOICES: OpenInvoice[] = [
  { number: "INV-2701", issueDate: "Mar 12, 2026", ageDays: 67, amount: 1840 },
  { number: "INV-2734", issueDate: "Apr 02, 2026", ageDays: 46, amount: 1260 },
  { number: "INV-2768", issueDate: "Apr 24, 2026", ageDays: 24, amount: 980 },
  { number: "INV-2802", issueDate: "May 04, 2026", ageDays: 14, amount: 820 },
  { number: "INV-2841", issueDate: "May 15, 2026", ageDays: 4, amount: 640 },
];

/** Walks FIFO across open invoices and returns how the payment was applied. */
export function allocatePayment(
  amount: number,
  invoices: OpenInvoice[],
): {
  invoiceNumber: string;
  applied: number;
  cleared: boolean;
}[] {
  const allocations: {
    invoiceNumber: string;
    applied: number;
    cleared: boolean;
  }[] = [];
  let remaining = amount;
  for (const inv of invoices) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, inv.amount);
    allocations.push({
      invoiceNumber: inv.number,
      applied,
      cleared: applied === inv.amount,
    });
    remaining -= applied;
  }
  return allocations;
}

// Aging totals BEFORE this payment is applied. The "after" version is
// computed in the scene by subtracting what FIFO allocates to each bucket.
export const AGING_BEFORE = {
  current: 9400,
  d30: 7800,
  d60: 2840,
  d90: 1840,
};
