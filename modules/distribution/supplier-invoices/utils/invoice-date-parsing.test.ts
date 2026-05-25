import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInvoiceDate } from "./invoice-date-parsing";

// ---------------------------------------------------------------------------
// ISO inputs (pass-through with validation)
// ---------------------------------------------------------------------------

test("parseInvoiceDate: passes through valid ISO YYYY-MM-DD", () => {
  assert.equal(parseInvoiceDate("2026-05-14"), "2026-05-14");
  assert.equal(parseInvoiceDate("2024-01-01"), "2024-01-01");
  assert.equal(parseInvoiceDate("2026-12-31"), "2026-12-31");
});

test("parseInvoiceDate: rejects invalid ISO calendar dates", () => {
  assert.equal(parseInvoiceDate("2026-02-30"), null, "Feb 30 doesn't exist");
  assert.equal(parseInvoiceDate("2026-13-01"), null, "month 13");
  assert.equal(parseInvoiceDate("2026-00-15"), null, "month 0");
  assert.equal(parseInvoiceDate("2026-04-31"), null, "April 31");
});

test("parseInvoiceDate: accepts YYYY/MM/DD and YYYY.MM.DD", () => {
  assert.equal(parseInvoiceDate("2026/05/14"), "2026-05-14");
  assert.equal(parseInvoiceDate("2026.05.14"), "2026-05-14");
});

// ---------------------------------------------------------------------------
// US M/D/Y forms — the format the bug actually surfaces in
// ---------------------------------------------------------------------------

test("parseInvoiceDate: US M/D/YYYY", () => {
  assert.equal(parseInvoiceDate("5/14/2026"), "2026-05-14");
  assert.equal(parseInvoiceDate("12/31/2024"), "2024-12-31");
  assert.equal(parseInvoiceDate("1/1/2025"), "2025-01-01");
});

test("parseInvoiceDate: US MM/DD/YYYY (zero-padded)", () => {
  assert.equal(parseInvoiceDate("05/14/2026"), "2026-05-14");
  assert.equal(parseInvoiceDate("04/20/2026"), "2026-04-20");
});

test("parseInvoiceDate: US M/D/YY with 2-digit year (00–69 → 2000s)", () => {
  assert.equal(parseInvoiceDate("5/14/26"), "2026-05-14");
  assert.equal(parseInvoiceDate("1/1/00"), "2000-01-01");
  assert.equal(parseInvoiceDate("12/31/69"), "2069-12-31");
});

test("parseInvoiceDate: US M/D/YY with 2-digit year (70–99 → 1900s)", () => {
  assert.equal(parseInvoiceDate("1/1/70"), "1970-01-01");
  assert.equal(parseInvoiceDate("12/31/99"), "1999-12-31");
});

test("parseInvoiceDate: US dashes M-D-YYYY", () => {
  assert.equal(parseInvoiceDate("5-14-2026"), "2026-05-14");
  assert.equal(parseInvoiceDate("12-31-2024"), "2024-12-31");
});

test("parseInvoiceDate: US dots M.D.YYYY", () => {
  assert.equal(parseInvoiceDate("5.14.2026"), "2026-05-14");
});

// ---------------------------------------------------------------------------
// Written month forms
// ---------------------------------------------------------------------------

test("parseInvoiceDate: written month, month-first variants", () => {
  assert.equal(parseInvoiceDate("April 20, 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("Apr 20, 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("Apr. 20, 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("April 20 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("Sept 15, 2024"), "2024-09-15");
});

test("parseInvoiceDate: written month, day-first variants", () => {
  assert.equal(parseInvoiceDate("20 April 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("20 Apr 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("20 Apr, 2026"), "2026-04-20");
});

test("parseInvoiceDate: case-insensitive month names", () => {
  assert.equal(parseInvoiceDate("april 20, 2026"), "2026-04-20");
  assert.equal(parseInvoiceDate("APR 20, 2026"), "2026-04-20");
});

// ---------------------------------------------------------------------------
// Whitespace and nullish inputs
// ---------------------------------------------------------------------------

test("parseInvoiceDate: trims whitespace", () => {
  assert.equal(parseInvoiceDate("  5/14/2026  "), "2026-05-14");
});

test("parseInvoiceDate: returns null for empty / null / undefined", () => {
  assert.equal(parseInvoiceDate(""), null);
  assert.equal(parseInvoiceDate("   "), null);
  assert.equal(parseInvoiceDate(null), null);
  assert.equal(parseInvoiceDate(undefined), null);
});

test("parseInvoiceDate: returns null for unparseable strings", () => {
  assert.equal(parseInvoiceDate("not a date"), null);
  assert.equal(parseInvoiceDate("Invoice 12345"), null);
  assert.equal(parseInvoiceDate("$160.00"), null);
  // Plausible-looking but missing a year:
  assert.equal(parseInvoiceDate("April 20"), null);
});

test("parseInvoiceDate: returns null for impossible calendar values", () => {
  assert.equal(parseInvoiceDate("13/14/2026"), null, "no month 13");
  assert.equal(parseInvoiceDate("2/30/2026"), null, "Feb 30 doesn't exist");
  assert.equal(parseInvoiceDate("April 31, 2026"), null, "April only has 30 days");
});
