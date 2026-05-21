import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFormStateWarnings } from "./form-state-warnings";
import type {
  SupplierInvoicePdfPrefillLine,
  SupplierInvoicePdfPrefillResult,
} from "./pdf-prefill";

function makeLine(productId: string): SupplierInvoicePdfPrefillLine {
  return {
    productId,
    unitType: "catch_weight",
    weightEntryMode: "total_weight",
    quantityCases: "1",
    weightLbs: "10",
    defaultCaseWeightLbs: "",
    caseWeightEntries: [""],
    unitPrice: "5",
    purchaseUnitAbbreviation: "",
    lotNumberOverride: "",
    expirationDateOverride: "",
  };
}

function makeResult(
  overrides: Partial<SupplierInvoicePdfPrefillResult["values"]> = {},
  extra: Partial<Omit<SupplierInvoicePdfPrefillResult, "values">> = {},
): SupplierInvoicePdfPrefillResult {
  return {
    values: {
      supplierId: "sup-1",
      supplierInvoiceNumber: "12345",
      invoiceDate: "2026-05-01",
      receiveDate: "2026-05-01",
      paymentMethod: null,
      notes: "",
      lines: [makeLine("prod-1")],
      ...overrides,
    },
    warnings: [],
    unmatchedSupplierCandidates: [],
    unmatchedLineDescriptions: [],
    sourceFilename: "invoice.pdf",
    totalComparison: {
      extractedTotal: "50.00",
      computedLineTotal: "50.00",
      variance: "0.00",
      matches: true,
    },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Clean state — no state warnings
// ---------------------------------------------------------------------------

test("buildFormStateWarnings: clean result yields only the receive-date hint", () => {
  const { warnings, invoiceDateUsedFallback } = buildFormStateWarnings(makeResult());
  assert.equal(invoiceDateUsedFallback, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Receive date defaulted to the invoice date/);
});

// ---------------------------------------------------------------------------
// Regressions: stale warnings reported by the user
// ---------------------------------------------------------------------------

test("buildFormStateWarnings: does NOT warn when supplier is matched", () => {
  const { warnings } = buildFormStateWarnings(makeResult({ supplierId: "sup-1" }));
  assert.ok(!warnings.some(w => /Supplier was not matched/.test(w)));
});

test("buildFormStateWarnings: does NOT warn when supplierInvoiceNumber is populated", () => {
  const { warnings } = buildFormStateWarnings(makeResult({ supplierInvoiceNumber: "57876" }));
  assert.ok(!warnings.some(w => /Supplier invoice number was not found/.test(w)));
});

test("buildFormStateWarnings: does NOT warn when all product lines are matched", () => {
  // unmatchedLineDescriptions empty (default in fixture) means everything matched.
  const { warnings } = buildFormStateWarnings(makeResult());
  assert.ok(!warnings.some(w => /Some product lines were not matched/.test(w)));
});

// ---------------------------------------------------------------------------
// Warning still fires when the field is genuinely missing
// ---------------------------------------------------------------------------

test("buildFormStateWarnings: warns when supplierId is empty", () => {
  const { warnings } = buildFormStateWarnings(makeResult({ supplierId: "" }));
  assert.ok(warnings.some(w => /Supplier was not matched/.test(w)));
});

test("buildFormStateWarnings: warns when supplierInvoiceNumber is empty", () => {
  const { warnings } = buildFormStateWarnings(makeResult({ supplierInvoiceNumber: "" }));
  assert.ok(warnings.some(w => /Supplier invoice number was not found/.test(w)));
});

test("buildFormStateWarnings: warns and backfills today when invoiceDate is empty", () => {
  const today = new Date().toISOString().slice(0, 10);
  const { warnings, resolvedInvoiceDate, invoiceDateUsedFallback } = buildFormStateWarnings(
    makeResult({ invoiceDate: "" }),
  );
  assert.equal(invoiceDateUsedFallback, true);
  assert.equal(resolvedInvoiceDate, today);
  assert.ok(warnings.some(w => /Invoice date was not found/.test(w)));
  // The receive-date hint is suppressed when no invoice date is available.
  assert.ok(!warnings.some(w => /Receive date defaulted/.test(w)));
});

test("buildFormStateWarnings: warns when any product line is unmatched", () => {
  const result = makeResult({}, { unmatchedLineDescriptions: ["MYSTERY MEAT"] });
  const { warnings } = buildFormStateWarnings(result);
  assert.ok(warnings.some(w => /Some product lines were not matched/.test(w)));
});

test("buildFormStateWarnings: warns when totals don't match", () => {
  const result = makeResult(
    {},
    {
      totalComparison: {
        extractedTotal: "100.00",
        computedLineTotal: "50.00",
        variance: "-50.00",
        matches: false,
      },
    },
  );
  const { warnings } = buildFormStateWarnings(result);
  assert.ok(warnings.some(w => /line totals do not match/i.test(w)));
});

test("buildFormStateWarnings: warns when no lines were extracted", () => {
  const result = makeResult({ lines: [] });
  const { warnings } = buildFormStateWarnings(result);
  assert.ok(warnings.some(w => /No invoice line items/i.test(w)));
});
