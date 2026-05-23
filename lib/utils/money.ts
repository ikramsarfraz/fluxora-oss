import Decimal from "decimal.js";

/**
 * Money helpers — thin wrapper over `decimal.js`. The invoicing pipeline
 * historically did all of its math in raw `Number` plus `.toFixed(2)`,
 * which surfaces floating-point quirks under loads of partial payments
 * (1¢ rounding errors, residual balance-due ≠ 0 after equality math,
 * margin% drift when summing many small line totals).
 *
 * The first migration target is the customer-payment math
 * (recordPayment + recordBulkPaymentForCustomer): every balance-due
 * comparison there is a real-money correctness check. Other invoicing
 * surfaces still run on Number — we'll move them over progressively.
 *
 * Convention: services receive amounts as strings from the wire
 * (Drizzle's `numeric` column type returns strings; form payloads are
 * strings). Keep them as strings until the math needs to happen; wrap
 * in `money(...)` for the calc; persist as `m.toFixed(2)` (or 4 for
 * sub-cent precision like cost/lb).
 */

/** Construct a Decimal from anything coerce-able. Empty / null → 0. */
export function money(input: string | number | null | undefined): Decimal {
  if (input == null || input === "") return new Decimal(0);
  return new Decimal(input);
}

/** Equivalent of `Number.isFinite(Number(x)) && Number(x) > 0`, but precise. */
export function isPositiveMoney(input: string | number | null | undefined): boolean {
  if (input == null || input === "") return false;
  try {
    return new Decimal(input).gt(0);
  } catch {
    return false;
  }
}

/**
 * Compare two amounts with a 1-cent tolerance. Mirrors the existing
 * `paymentAmount - currentBalanceDue > 0.01` overpayment check, but in
 * exact arithmetic — no chance of `0.1 + 0.2 > 0.3` shenanigans
 * pushing a legitimate full-balance payment over the cliff.
 */
export function exceedsByCent(amount: Decimal | string | number, ceiling: Decimal | string | number): boolean {
  const a = amount instanceof Decimal ? amount : new Decimal(amount);
  const c = ceiling instanceof Decimal ? ceiling : new Decimal(ceiling);
  return a.minus(c).gt("0.01");
}

/**
 * Decimal-aware max — used for "balance due can never go negative" math.
 * `Math.max(value, 0)` works for finite numbers; this is just the
 * equivalent staying in Decimal-land.
 */
export function nonNegative(value: Decimal): Decimal {
  return value.lt(0) ? new Decimal(0) : value;
}

/** Format for storage in a `numeric(_, 2)` column. */
export function toMoneyString(value: Decimal): string {
  return value.toFixed(2);
}
