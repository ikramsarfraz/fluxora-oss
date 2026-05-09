import assert from "node:assert/strict";
import { test } from "node:test";

import {
  scoreParseResult,
  detectScannedPdf,
  type ParsedConfidenceBreakdown,
} from "./pipeline-scoring";
import type { SupplierInvoicePdfPrefillResult } from "./pdf-prefill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(
  overrides: Partial<SupplierInvoicePdfPrefillResult> = {},
): SupplierInvoicePdfPrefillResult {
  return {
    values: {
      supplierId: "supplier-1",
      invoiceNumber: "12345",
      invoiceDate: "2026-04-20",
      receiveDate: "2026-04-20",
      paymentMethod: null,
      notes: "",
      lines: [
        {
          productId: "product-1",
          unitType: "catch_weight",
          weightEntryMode: "total_weight",
          quantityCases: "2",
          weightLbs: "50.0000",
          defaultCaseWeightLbs: "",
          caseWeightEntries: ["", ""],
          unitPrice: "5.00",
          lotNumberOverride: "",
          expirationDateOverride: "",
        },
      ],
    },
    warnings: ["Receive date defaulted to the invoice date. Adjust it if the shipment arrived later."],
    unmatchedSupplierCandidates: [],
    unmatchedLineDescriptions: [],
    sourceFilename: "invoice.pdf",
    totalComparison: {
      extractedTotal: "500.00",
      computedLineTotal: "500.00",
      variance: "0.00",
      matches: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreParseResult — confidence scoring
// ---------------------------------------------------------------------------

test("scoreParseResult: perfect parse gives full score", () => {
  const result = makeResult();
  const breakdown = scoreParseResult(result);
  assert.equal(breakdown.score, 100);
  assert.equal(breakdown.invoiceNumberFound, true);
  assert.equal(breakdown.invoiceDateFound, true);
  assert.equal(breakdown.supplierMatched, true);
  assert.equal(breakdown.linesExtracted, true);
  assert.equal(breakdown.totalsMatch, true);
  assert.equal(breakdown.unmatchedProductRatio, 0);
});

test("scoreParseResult: missing invoice number reduces score by 20", () => {
  const result = makeResult({
    values: { ...makeResult().values, invoiceNumber: "" },
  });
  const breakdown = scoreParseResult(result);
  assert.equal(breakdown.invoiceNumberFound, false);
  assert.ok(breakdown.score <= 80, `Expected <= 80, got ${breakdown.score}`);
});

test("scoreParseResult: missing supplier reduces score by 20", () => {
  const result = makeResult({
    values: { ...makeResult().values, supplierId: "" },
  });
  const breakdown = scoreParseResult(result);
  assert.equal(breakdown.supplierMatched, false);
  assert.ok(breakdown.score <= 80, `Expected <= 80, got ${breakdown.score}`);
});

test("scoreParseResult: totals mismatch reduces score by 15", () => {
  const result = makeResult({
    totalComparison: {
      extractedTotal: "600.00",
      computedLineTotal: "500.00",
      variance: "100.00",
      matches: false,
    },
  });
  const breakdown = scoreParseResult(result);
  assert.ok(breakdown.score <= 85, `Expected <= 85, got ${breakdown.score}`);
});

test("scoreParseResult: null totals gives partial credit", () => {
  const result = makeResult({
    totalComparison: {
      extractedTotal: null,
      computedLineTotal: "500.00",
      variance: null,
      matches: null,
    },
  });
  const breakdown = scoreParseResult(result);
  assert.ok(breakdown.score > 80 && breakdown.score <= 100);
});

test("scoreParseResult: unmatched product lines reduces score", () => {
  const result = makeResult({
    values: {
      ...makeResult().values,
      lines: [
        {
          productId: "", // unmatched
          unitType: "catch_weight",
          weightEntryMode: "total_weight",
          quantityCases: "1",
          weightLbs: "0",
          defaultCaseWeightLbs: "",
          caseWeightEntries: [""],
          unitPrice: "0",
          lotNumberOverride: "",
          expirationDateOverride: "",
        },
      ],
    },
    unmatchedLineDescriptions: ["MYSTERY PRODUCT"],
  });
  const breakdown = scoreParseResult(result);
  assert.equal(breakdown.linesExtracted, false);
  assert.ok(breakdown.score < 100);
});

test("scoreParseResult: score never exceeds 100 or drops below 0", () => {
  const minResult = makeResult({
    values: {
      supplierId: "",
      invoiceNumber: "",
      invoiceDate: "",
      receiveDate: "",
      paymentMethod: null,
      notes: "",
      lines: [
        {
          productId: "",
          unitType: "catch_weight",
          weightEntryMode: "total_weight",
          quantityCases: "1",
          weightLbs: "0",
          defaultCaseWeightLbs: "",
          caseWeightEntries: [""],
          unitPrice: "0",
          lotNumberOverride: "",
          expirationDateOverride: "",
        },
      ],
    },
    warnings: ["Invoice date was not found. Today was used as a placeholder."],
    unmatchedLineDescriptions: ["PRODUCT A"],
    totalComparison: { extractedTotal: null, computedLineTotal: "0.00", variance: null, matches: null },
  });
  const breakdown = scoreParseResult(minResult);
  assert.ok(breakdown.score >= 0 && breakdown.score <= 100);
});

// ---------------------------------------------------------------------------
// detectScannedPdf
// ---------------------------------------------------------------------------

test("detectScannedPdf: empty text is scanned", () => {
  assert.equal(detectScannedPdf(""), true);
});

test("detectScannedPdf: very short text is scanned", () => {
  assert.equal(detectScannedPdf("abc"), true);
});

test("detectScannedPdf: rich text is not scanned", () => {
  const longText = "INVOICE 12345 SUPPLIER SUMMIT TRADING CHICKEN BREAST 10 CASES 400 LBS $3.25 $1300.00 BALANCE DUE $1300.00";
  assert.equal(detectScannedPdf(longText, 1), false);
});

test("detectScannedPdf: multi-page PDF with very few chars per page is scanned", () => {
  // 50 chars total across 5 pages = 10 chars/page → scanned
  const sparseText = "x".repeat(50);
  assert.equal(detectScannedPdf(sparseText, 5), true);
});

test("detectScannedPdf: single-page PDF with adequate text is not scanned", () => {
  const richText = "INVOICE\nDATE 04/20/2026\nSUPPLIER SUMMIT TRADING\n" + "CHICKEN 10 CASES 400 LBS $3.25 TOTAL $1300.00\n".repeat(5);
  assert.equal(detectScannedPdf(richText, 1), false);
});

// ---------------------------------------------------------------------------
// Deterministic parser confidence scoring — integration with existing parser
// ---------------------------------------------------------------------------

import { parseSupplierInvoicePdfText } from "./pdf-prefill";

const SAMPLE_INVOICE_TEXT = `
MAKE CHECK PAYABLE TO SUMMIT TRADING
ALI TRADERS
Invoice
BILL TO
ACME DISTRIBUTION
INVOICE #DATETOTAL DUEDUE DATETERMSENCLOSED
5787604/20/2026$1,536.8004/20/2026Due on receipt
PRODUCTDESCRIPTIONQTYRATEAMOUNT
JUMBO CHICKEN TENDER10 BOX=10X40
400.00 LBS
4003.251,300.00
JUMBO CHICKEN BREAST2 BOX=2X40
80.00 LBS
802.96236.80
BALANCE DUE
$1,536.80
`;

test("scoreParseResult: successful parse scores high confidence", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "supplier-1", name: "SUMMIT TRADING" }],
    products: [
      { id: "product-1", name: "JUMBO CHICKEN TENDER" },
      { id: "product-2", name: "JUMBO CHICKEN BREAST" },
    ],
  });
  const breakdown = scoreParseResult(result);
  assert.ok(breakdown.score >= 80, `Expected >= 80 for full parse, got ${breakdown.score}`);
  assert.equal(breakdown.invoiceNumberFound, true);
  assert.equal(breakdown.supplierMatched, true);
  assert.equal(breakdown.totalsMatch, true);
});

test("scoreParseResult: no supplier match lowers confidence below threshold", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [],
    products: [],
  });
  const breakdown = scoreParseResult(result);
  assert.ok(breakdown.score < 60, `Expected < 60 for no-supplier parse, got ${breakdown.score}`);
  assert.equal(breakdown.supplierMatched, false);
});

// ---------------------------------------------------------------------------
// Multi-page repeated header handling (parser utility)
// ---------------------------------------------------------------------------

const MULTI_PAGE_INVOICE = `
Invoice
Date
4/20/2026
Invoice #
999001
Bill To
Acme Distribution
Zabiha Halal Meat Processors
ItemDescriptionQtyQty/WeightRateAmount
RR Brisket Short RibBrisket Short Rib156.606.55370.73
ItemDescriptionQtyQty/WeightRateAmount
RR RIB EYE1pc15.9012.80203.52
$574.25
`;

test("parser handles repeated table headers across pages without duplicating them", () => {
  const result = parseSupplierInvoicePdfText({
    text: MULTI_PAGE_INVOICE,
    sourceFilename: "multi-page.pdf",
    suppliers: [{ id: "zabiha-1", name: "Zabiha Halal Meat Processors" }],
    products: [
      { id: "p-1", name: "Brisket Short Rib" },
      { id: "p-2", name: "RR RIB EYE" },
    ],
  });
  // Should have 2 lines, not 3 (headers don't become lines)
  assert.equal(result.values.lines.length, 2);
});

// ---------------------------------------------------------------------------
// Supplier and tenant scoping (pure logic tests)
// ---------------------------------------------------------------------------

test("supplier matching is tenant-scoped: supplier from different tenant is never matched", () => {
  // Simulate two tenants with same supplier name but different IDs
  const tenant1Result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "tenant1-supplier", name: "SUMMIT TRADING" }],
    products: [],
  });
  const tenant2Result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "tenant2-supplier", name: "SUMMIT TRADING" }],
    products: [],
  });

  // Each tenant's parser sees only its own supplier IDs
  assert.equal(tenant1Result.values.supplierId, "tenant1-supplier");
  assert.equal(tenant2Result.values.supplierId, "tenant2-supplier");
  assert.notEqual(tenant1Result.values.supplierId, tenant2Result.values.supplierId);
});

test("product matching is tenant-scoped: products not in candidate list are never matched", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "s-1", name: "SUMMIT TRADING" }],
    products: [], // no products available for this tenant
  });
  assert.ok(result.values.lines.every(l => l.productId === ""));
  assert.equal(result.unmatchedLineDescriptions.length, 2);
});
