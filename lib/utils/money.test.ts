import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";

import {
  exceedsByCent,
  isPositiveMoney,
  money,
  nonNegative,
  toMoneyString,
} from "./money";

test("money() handles null/undefined/empty as 0", () => {
  assert.equal(money(null).toString(), "0");
  assert.equal(money(undefined).toString(), "0");
  assert.equal(money("").toString(), "0");
});

test("money() preserves exact decimals coming off Drizzle numeric columns", () => {
  assert.equal(money("1234.5678").toString(), "1234.5678");
});

test("isPositiveMoney() distinguishes 0 / negative / positive", () => {
  assert.equal(isPositiveMoney("0"), false);
  assert.equal(isPositiveMoney("-1"), false);
  assert.equal(isPositiveMoney("0.01"), true);
  assert.equal(isPositiveMoney(""), false);
  assert.equal(isPositiveMoney(null), false);
});

test("isPositiveMoney() rejects non-numeric strings without throwing", () => {
  assert.equal(isPositiveMoney("abc"), false);
});

test("exceedsByCent() — equal amounts do not exceed", () => {
  assert.equal(exceedsByCent("100.00", "100.00"), false);
});

test("exceedsByCent() — 1 cent over is the tolerance (not exceeded)", () => {
  assert.equal(exceedsByCent("100.01", "100.00"), false);
});

test("exceedsByCent() — 2 cents over does exceed", () => {
  assert.equal(exceedsByCent("100.02", "100.00"), true);
});

test("exceedsByCent() — Number FP edge case (0.1 + 0.2 ≠ 0.3)", () => {
  // The whole point of moving off Number: this used to potentially
  // trip the overpayment check on a legitimate full-balance payment.
  const a = money("0.1").plus("0.2");
  assert.equal(a.toString(), "0.3");
  assert.equal(exceedsByCent(a, "0.3"), false);
});

test("nonNegative() clamps below-zero to zero", () => {
  assert.equal(nonNegative(new Decimal("-5")).toString(), "0");
});

test("nonNegative() leaves positive values alone", () => {
  assert.equal(nonNegative(new Decimal("12.34")).toString(), "12.34");
});

test("toMoneyString() always returns 2 decimal places", () => {
  assert.equal(toMoneyString(new Decimal("1")), "1.00");
  assert.equal(toMoneyString(new Decimal("1.5")), "1.50");
  assert.equal(toMoneyString(new Decimal("1.234")), "1.23"); // banker rounding via Decimal default
});

test("payment scenario: many partial payments sum exactly to total", () => {
  // The bug FP arithmetic causes: 100 payments of $1.10 should equal $110,
  // but Number sums drift. Decimal sums are exact.
  let total = new Decimal(0);
  for (let i = 0; i < 100; i++) {
    total = total.plus("1.10");
  }
  assert.equal(total.toString(), "110");
  assert.equal(exceedsByCent(total, "110.00"), false);
});

test("bulk payment scenario: balance closes cleanly with Decimal math", () => {
  // Mirrors recordBulkPaymentForCustomer's loop:
  // start balance 100.00, three allocations of 33.33 + one of 0.01
  let balance = money("100.00");
  for (const allocation of ["33.33", "33.33", "33.33", "0.01"]) {
    const amt = money(allocation);
    assert.equal(exceedsByCent(amt, balance), false, `allocation ${allocation} should not exceed`);
    balance = balance.minus(amt);
  }
  assert.equal(balance.toString(), "0");
});
