import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  formatMoney,
  formatTaxRatePercent,
  parseTaxRatePercent,
  SUPPORTED_CURRENCIES,
} from "./currency";

// The Intl.NumberFormat output uses NBSP / NNBSP between the symbol and
// the digits depending on locale — strip them so the assertions read
// naturally. Tests assert the meaningful characters (symbol + digits)
// rather than the exact spacing, which is a Node-version detail.
function normalize(s: string): string {
  return s.replace(/[  \s]/g, "");
}

test("formatMoney defaults to USD when no currency is passed", () => {
  assert.equal(normalize(formatMoney(1234.5)), "$1,234.50");
});

test("formatMoney renders the USD symbol on the left", () => {
  assert.equal(normalize(formatMoney(0, "USD")), "$0.00");
  assert.equal(normalize(formatMoney(9.5, "USD")), "$9.50");
});

test("formatMoney renders EUR with the euro symbol", () => {
  const out = normalize(formatMoney(1234.5, "EUR"));
  assert.ok(
    out.includes("€"),
    `expected euro symbol in ${JSON.stringify(out)}`,
  );
  assert.ok(
    out.includes("1,234.50"),
    `expected formatted amount in ${JSON.stringify(out)}`,
  );
});

test("formatMoney renders GBP with the pound symbol", () => {
  const out = normalize(formatMoney(42, "GBP"));
  assert.ok(out.includes("£"), `expected pound symbol in ${out}`);
  assert.ok(out.includes("42.00"), `expected formatted amount in ${out}`);
});

test("formatMoney renders CAD with the dollar symbol (en-CA locale)", () => {
  const out = normalize(formatMoney(1000, "CAD"));
  assert.ok(out.includes("$"), `expected dollar symbol in ${out}`);
  assert.ok(out.includes("1,000.00"), `expected formatted amount in ${out}`);
});

test("formatMoney handles null / empty / NaN by rendering zero in the right currency", () => {
  // The zero fallback must still be rendered in the chosen currency so
  // a "—" doesn't appear mid-column under a "EUR" header.
  assert.equal(normalize(formatMoney(null, "USD")), "$0.00");
  assert.equal(normalize(formatMoney("", "USD")), "$0.00");
  assert.equal(normalize(formatMoney("not-a-number", "USD")), "$0.00");
  assert.ok(normalize(formatMoney(null, "EUR")).includes("€"));
});

test("formatMoney accepts string input as well as number", () => {
  assert.equal(normalize(formatMoney("99.5", "USD")), "$99.50");
});

test("formatMoney falls back to USD on an unknown currency code", () => {
  // Defensive: a stale client cache or a future enum value should not
  // crash the page; rendering USD is the safe degraded behavior.
  assert.equal(
    normalize(formatMoney(1, "ZZZ" as "USD")),
    "$1.00",
  );
});

test("SUPPORTED_CURRENCIES is the closed list (USD/EUR/GBP/CAD)", () => {
  const codes = SUPPORTED_CURRENCIES.map(c => c.code).sort();
  assert.deepEqual(codes, ["CAD", "EUR", "GBP", "USD"]);
});

test("formatTaxRatePercent and parseTaxRatePercent round-trip", () => {
  // The DB stores the fraction (0.0825 = 8.25%); the UI shows the
  // percent form. The pair has to be exactly inverse so saving and
  // re-rendering doesn't drift.
  const stored = "0.0825";
  assert.equal(formatTaxRatePercent(stored), "8.25");
  assert.equal(parseTaxRatePercent("8.25"), "0.0825");
});

test("formatTaxRatePercent returns empty string for null/empty/NaN", () => {
  assert.equal(formatTaxRatePercent(null), "");
  assert.equal(formatTaxRatePercent(""), "");
  assert.equal(formatTaxRatePercent("not-a-number"), "");
});

test("parseTaxRatePercent returns null for blank input", () => {
  assert.equal(parseTaxRatePercent(""), null);
  assert.equal(parseTaxRatePercent("   "), null);
});

test("parseTaxRatePercent rejects out-of-range values", () => {
  assert.throws(() => parseTaxRatePercent("-1"), /between 0 and/);
  assert.throws(() => parseTaxRatePercent("150"), /between 0 and/);
  assert.throws(() => parseTaxRatePercent("abc"), /must be a number/);
});
