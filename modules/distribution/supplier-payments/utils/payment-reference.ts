/**
 * Bill payments split the legacy single `reference` column into two —
 * `checkNumber` (physical-artifact identifier) and `referenceNumber`
 * (bank reference / transaction ID). Most surfaces want a single
 * display string with whichever is set. This helper picks the
 * appropriate one based on payment method, falling back across the
 * other for resilience.
 */
export function formatBillPaymentReference(payment: {
  paymentMethod: string;
  checkNumber: string | null;
  referenceNumber: string | null;
}): string | null {
  if (payment.paymentMethod === "check" && payment.checkNumber) {
    return `Check #${payment.checkNumber}`;
  }
  if (payment.referenceNumber) {
    return payment.referenceNumber;
  }
  // Fallback — surface a check number even if method isn't check (data
  // may have come from imports or older releases).
  if (payment.checkNumber) {
    return `Check #${payment.checkNumber}`;
  }
  return null;
}
