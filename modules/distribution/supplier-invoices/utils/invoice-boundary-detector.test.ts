import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectInvoiceNumberInPageHeader,
  detectInvoiceSegments,
  splitByPageMarkers,
} from "./invoice-boundary-detector";

// ---------------------------------------------------------------------------
// splitByPageMarkers
// ---------------------------------------------------------------------------

test("splitByPageMarkers: groups lines under their preceding marker", () => {
  const input = [
    "--- Page 1 ---",
    "Invoice #",
    "1001",
    "",
    "--- Page 2 ---",
    "Invoice #",
    "1002",
  ].join("\n");
  const pages = splitByPageMarkers(input);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].pageNumber, 1);
  assert.ok(pages[0].text.includes("1001"));
  assert.equal(pages[1].pageNumber, 2);
  assert.ok(pages[1].text.includes("1002"));
});

test("splitByPageMarkers: empty input yields an empty array", () => {
  assert.deepEqual(splitByPageMarkers(""), []);
});

// ---------------------------------------------------------------------------
// detectInvoiceNumberInPageHeader
// ---------------------------------------------------------------------------

test("detectInvoiceNumberInPageHeader: picks up 'Invoice #1001'", () => {
  assert.equal(
    detectInvoiceNumberInPageHeader("Acme Trading\nInvoice #1001\nDate 5/14"),
    "1001",
  );
});

test("detectInvoiceNumberInPageHeader: picks up 'INVOICE NO: A-2026-001'", () => {
  assert.equal(
    detectInvoiceNumberInPageHeader("INVOICE NO: A-2026-001\n"),
    "A-2026-001",
  );
});

test("detectInvoiceNumberInPageHeader: ignores label words after 'Invoice'", () => {
  // "Invoice Date" / "Invoice Total" — the word after 'Invoice' is a
  // field label, not a number. The validity guard drops it and the
  // detector returns null rather than locking onto "DATE" / "TOTAL".
  assert.equal(detectInvoiceNumberInPageHeader("Invoice Date 5/14/2026"), null);
  assert.equal(
    detectInvoiceNumberInPageHeader("Invoice Total $1,234.00"),
    null,
  );
});

test("detectInvoiceNumberInPageHeader: requires at least one digit", () => {
  // 'RECEIPT' is alphanumeric but has no digit — guard rejects it so a
  // document type stamp can't masquerade as an invoice number.
  assert.equal(
    detectInvoiceNumberInPageHeader("Invoice: RECEIPT\nfor your records"),
    null,
  );
});

test("detectInvoiceNumberInPageHeader: header window cuts off after 500 chars", () => {
  // An invoice-number-like sequence buried in body text shouldn't
  // trigger a header match. Pad the front so the only "Invoice #" is
  // safely past 500 chars.
  const padding = "x".repeat(600);
  const text = `${padding}\nInvoice #9999`;
  assert.equal(detectInvoiceNumberInPageHeader(text), null);
});

test("detectInvoiceNumberInPageHeader: first valid candidate wins", () => {
  // Two patterns in the header. The detector should return the first
  // one it sees that passes the validity guard, not a later one.
  const text = "Invoice #2026-100\nP.O. Invoice #777\nDate 5/14";
  assert.equal(detectInvoiceNumberInPageHeader(text), "2026-100");
});

test("detectInvoiceNumberInPageHeader: 'Inv 1001' short form is recognised", () => {
  assert.equal(
    detectInvoiceNumberInPageHeader("Inv 1001\nDate 5/14"),
    "1001",
  );
});

// ---------------------------------------------------------------------------
// detectInvoiceSegments
// ---------------------------------------------------------------------------

const SINGLE_INVOICE = [
  "--- Page 1 ---",
  "Acme Trading",
  "Invoice #1001",
  "Date 5/14/2026",
  "",
  "Line 1 ... $100.00",
  "Line 2 ... $250.00",
  "Total $350.00",
].join("\n");

test("detectInvoiceSegments: a single-invoice PDF returns one segment", () => {
  const segs = detectInvoiceSegments(SINGLE_INVOICE);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].startPage, 1);
  assert.equal(segs[0].endPage, 1);
  assert.equal(segs[0].detectedInvoiceNumber, "1001");
});

test("detectInvoiceSegments: a 2-page single invoice stays as one segment", () => {
  // Page 2 is a continuation with no invoice header — should append to
  // page 1's segment, not start a new one.
  const text = [
    SINGLE_INVOICE,
    "",
    "--- Page 2 ---",
    "Line 3 ... $400.00",
    "Continued from page 1",
  ].join("\n");
  const segs = detectInvoiceSegments(text);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].startPage, 1);
  assert.equal(segs[0].endPage, 2);
});

test("detectInvoiceSegments: two distinct invoices on consecutive pages split", () => {
  const text = [
    "--- Page 1 ---",
    "Acme Trading",
    "Invoice #1001",
    "Total $100.00",
    "",
    "--- Page 2 ---",
    "Acme Trading",
    "Invoice #1002",
    "Total $250.00",
  ].join("\n");
  const segs = detectInvoiceSegments(text);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].detectedInvoiceNumber, "1001");
  assert.equal(segs[0].startPage, 1);
  assert.equal(segs[0].endPage, 1);
  assert.equal(segs[1].detectedInvoiceNumber, "1002");
  assert.equal(segs[1].startPage, 2);
  assert.equal(segs[1].endPage, 2);
});

test("detectInvoiceSegments: 3-invoice bundle with one multi-page invoice", () => {
  // Layout: invoice A on pages 1-2 (continuation page), B on page 3,
  // C on pages 4-5. The middle invoice is single-page; the bookends
  // both span two pages.
  const text = [
    "--- Page 1 ---",
    "Invoice #A-100",
    "Lines...",
    "",
    "--- Page 2 ---",
    "(continued)",
    "more lines...",
    "Total $111",
    "",
    "--- Page 3 ---",
    "Invoice #B-200",
    "Total $222",
    "",
    "--- Page 4 ---",
    "Invoice #C-300",
    "Lines...",
    "",
    "--- Page 5 ---",
    "(continued)",
    "Total $333",
  ].join("\n");

  const segs = detectInvoiceSegments(text);
  assert.equal(segs.length, 3);
  assert.deepEqual(
    segs.map(s => ({
      n: s.detectedInvoiceNumber,
      start: s.startPage,
      end: s.endPage,
    })),
    [
      { n: "A-100", start: 1, end: 2 },
      { n: "B-200", start: 3, end: 3 },
      { n: "C-300", start: 4, end: 5 },
    ],
  );
});

test("detectInvoiceSegments: a PDF with NO invoice numbers stays one segment", () => {
  // No header marker we can recognise. The conservative fallback is to
  // run the existing single-invoice pipeline against the whole doc.
  const text = [
    "--- Page 1 ---",
    "Acme Trading",
    "Total $100",
    "--- Page 2 ---",
    "Continued",
  ].join("\n");
  const segs = detectInvoiceSegments(text);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].startPage, 1);
  assert.equal(segs[0].endPage, 2);
  assert.equal(segs[0].detectedInvoiceNumber, null);
});

test("detectInvoiceSegments: only ONE invoice number across N pages stays one segment", () => {
  // Same invoice number on pages 1 and 2 (repeated header). No second
  // distinct number exists, so the document is treated as a single
  // invoice — the detector never gets to the "split when isNewInvoice"
  // branch.
  const text = [
    "--- Page 1 ---",
    "Invoice #1001",
    "Total $100",
    "--- Page 2 ---",
    "Invoice #1001",
    "(continued)",
  ].join("\n");
  const segs = detectInvoiceSegments(text);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].endPage, 2);
});

test("detectInvoiceSegments: detected segment text preserves --- Page N --- markers", () => {
  // Downstream code parses these markers; segments must keep them or
  // the per-page parsing inside the pipeline regresses.
  const text = [
    "--- Page 1 ---",
    "Invoice #1001",
    "Total $100",
    "",
    "--- Page 2 ---",
    "Invoice #1002",
    "Total $200",
  ].join("\n");
  const segs = detectInvoiceSegments(text);
  assert.ok(segs[0].text.includes("--- Page 1 ---"));
  assert.ok(segs[1].text.includes("--- Page 2 ---"));
});
