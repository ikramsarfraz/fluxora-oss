import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSupplierInvoicePdfText } from "./pdf-prefill";

const SAMPLE_INVOICE_TEXT = `
MAKE CHECK PAYABLE TO SUMMIT TRADING
ALI TRADERS
524 Morse Ave
Schaumburg, IL  60193
8472204892
billing@example.com
Invoice
BILL TO
ACME DISTRIBUTION
5508 ELMWOOD AVE
STE 403
INDIANAPOLIS, IN  46203 USA
INVOICE #DATETOTAL DUEDUE DATETERMSENCLOSED
5787604/20/2026$1,536.8004/20/2026Due on receipt
PRODUCTDESCRIPTIONQTYRATEAMOUNT
JUMBO CHICKEN TENDER10 BOX=10X40
400.00 LBS
4003.251,300.00
JUMBO CHICKEN BREAST2 BOX=2X40
80.00 LBS
802.96236.80
____________________________
Signature
*Check delivery, NO RETURNS after 24 hours.*
ZELLE PAYMENT DETAILS:
847-340-7074
billing@example.com
BALANCE DUE
$1,536.80
`;

const BREWER_INVOICE_TEXT = `
Payment Policy
Invoice
DATE
4/21/2026
INVOICE #
137098
SOLD TO
Acme Distribution LLC
5508 Elmwood Ave STE 403
Indianapolis, IN 46203
P.O. NO.TERMS
Due on receipt
Due Date
4/21/2026
BREWER LIVESTOCK
DESCRIPTIONQUANTITYWEIGHTPRICEAMOUNT
goat (K--30/39.5) "A"1cs3010.45313.50
Cut Fee135.0035.00
B/I Lamb Shldrs Imported1cs34.484.82166.19
Lamb Rack Frenched2cs59.716.20967.14
Delivery Charge15.0015.00
Claims for shortages/spoilage must be made within 24 hours
$1,496.83
$53.09
`;

const ZABIHA_INVOICE_TEXT = `
Invoice
Date
4/20/2026
Invoice #
243192
Bill To
Acme Distribution LLC
Ship To
Zabiha Halal Meat Processors
1715 W. Cortland Ct Unit 2
Addison, IL 60101
TermsDue Date
4/20/2026
ItemDescriptionQtyQty/WeightRateAmount
RR Brisket Short RibBrisket Short Rib156.606.55370.73
RR Brisket Short RibBrisket Short Rib2pc25.206.55165.06
RR Brisket Point PrimeBEEF PRIME BRISKET POINT EXP179.105.75454.83
RR RIB EYE1pc15.9012.80203.52
2x20 Gyros ConesFatima Halal Small Cones (2 cones per case - 20lbs each1010.00143.001,430.00
TR Ground BeefGround Beef; 80/20 Lean  Wts: 30.2 - 30.3260.504.89295.85
RR Bladerst CH/RLBEEF BLADE EYE EXP1c17.705.4095.58
Chicken Ham Deli SlicedSmoked & Sliced @ 12 oz packages11.006.096.09
PastramiApprox 12 oz Packets11.008.198.19
*No claims allowed unless reported upon arrival of goods.
$3,029.85
$3,029.85
$0.00
$3,029.85
`;

test("parses the attached supplier invoice text", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "supplier-1", name: "SUMMIT TRADING" }],
    products: [
      { id: "product-1", name: "JUMBO CHICKEN TENDER", sku: "TENDER" },
      { id: "product-2", name: "JUMBO CHICKEN BREAST", sku: "BREAST" },
    ],
  });

  assert.equal(result.sourceFilename, "Invoice 57876.pdf");
  assert.deepEqual(result.unmatchedSupplierCandidates, []);
  assert.equal(result.values.supplierId, "supplier-1");
  assert.equal(result.values.supplierInvoiceNumber, "57876");
  assert.equal(result.values.invoiceDate, "2026-04-20");
  assert.equal(result.values.receiveDate, "2026-04-20");
  assert.equal(result.values.paymentMethod, null);
  assert.equal(result.values.lines.length, 2);
  assert.deepEqual(
    result.values.lines.map(line => ({
      productId: line.productId,
      quantityCases: line.quantityCases,
      weightLbs: line.weightLbs,
      unitPrice: line.unitPrice,
    })),
    [
      {
        productId: "product-1",
        quantityCases: "10",
        weightLbs: "400.0000",
        unitPrice: "3.2500",
      },
      {
        productId: "product-2",
        quantityCases: "2",
        weightLbs: "80.0000",
        unitPrice: "2.9600",
      },
    ],
  );
  assert.equal(result.totalComparison.extractedTotal, "1536.80");
  assert.equal(result.totalComparison.computedLineTotal, "1536.80");
  assert.equal(result.totalComparison.matches, true);
});

test("leaves unresolved suppliers and products for the user", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT,
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [],
    products: [],
  });

  assert.equal(result.values.supplierId, "");
  assert.deepEqual(result.unmatchedSupplierCandidates, [
    "SUMMIT TRADING",
    "ALI TRADERS",
  ]);
  assert.deepEqual(result.unmatchedLineDescriptions, [
    "JUMBO CHICKEN TENDER",
    "JUMBO CHICKEN BREAST",
  ]);
  // Final-state warnings are evaluated by buildFormStateWarnings in the
  // pipeline (see form-state-warnings.test.ts), not by the parser itself.
});

test("flags total-balance mismatches in totalComparison", () => {
  const result = parseSupplierInvoicePdfText({
    text: SAMPLE_INVOICE_TEXT.replace(/\$1,536\.80/g, "$1,500.00"),
    sourceFilename: "Invoice 57876.pdf",
    suppliers: [{ id: "supplier-1", name: "SUMMIT TRADING" }],
    products: [
      { id: "product-1", name: "JUMBO CHICKEN TENDER" },
      { id: "product-2", name: "JUMBO CHICKEN BREAST" },
    ],
  });

  assert.equal(result.totalComparison.extractedTotal, "1500.00");
  assert.equal(result.totalComparison.computedLineTotal, "1536.80");
  assert.equal(result.totalComparison.variance, "36.80");
  assert.equal(result.totalComparison.matches, false);
});

test("returns an editable placeholder when no line items can be read", () => {
  const result = parseSupplierInvoicePdfText({
    text: "Invoice 12345 04/20/2026 Balance Due $12.00",
    sourceFilename: "empty.pdf",
    suppliers: [],
    products: [],
  });

  assert.equal(result.values.lines.length, 1);
  assert.equal(result.values.lines[0].productId, "");
});

test("leaves invoiceDate empty when no date is found in the text", () => {
  const result = parseSupplierInvoicePdfText({
    text: "Invoice 12345 Balance Due $12.00",
    sourceFilename: "empty.pdf",
    suppliers: [],
    products: [],
  });

  assert.equal(result.values.invoiceDate, "");
  assert.equal(result.values.receiveDate, "");
});

test("parses Brewer Livestock packed invoice rows", () => {
  const result = parseSupplierInvoicePdfText({
    text: BREWER_INVOICE_TEXT,
    sourceFilename: "Inv_137098_from_BREWER_LIVESTOCK_6320.pdf",
    suppliers: [{ id: "supplier-brewer", name: "Brewer Livestock" }],
    products: [
      { id: "product-goat", name: "goat" },
      { id: "product-lamb-shoulders", name: "B/I Lamb Shldrs Imported" },
      { id: "product-lamb-rack", name: "Lamb Rack Frenched" },
    ],
  });

  assert.equal(result.values.supplierId, "supplier-brewer");
  assert.equal(result.values.supplierInvoiceNumber, "137098");
  assert.equal(result.values.invoiceDate, "2026-04-21");
  assert.deepEqual(
    result.values.lines.map(line => ({
      productId: line.productId,
      unitType: line.unitType,
      quantityCases: line.quantityCases,
      weightLbs: line.weightLbs,
      unitPrice: line.unitPrice,
    })),
    [
      {
        productId: "product-goat",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "30.0000",
        unitPrice: "10.4500",
      },
      {
        productId: "product-lamb-shoulders",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "34.4800",
        unitPrice: "4.8200",
      },
      {
        productId: "product-lamb-rack",
        unitType: "catch_weight",
        quantityCases: "2",
        weightLbs: "59.7000",
        unitPrice: "16.2000",
      },
    ],
  );
  assert.equal(result.totalComparison.extractedTotal, "1496.83");
  assert.equal(result.totalComparison.computedLineTotal, "1446.83");
  assert.equal(result.totalComparison.matches, false);
  assert.match(result.warnings.join(" "), /Cut Fee, Delivery Charge/);
});

// ---------------------------------------------------------------------------
// Regression: flexible header detection (generic keyword matching)
// ---------------------------------------------------------------------------

const NONSTANDARD_HEADER_INVOICE = `
Custom Meats Inc.
Invoice No: 9001
Date: 05/01/2026
Bill To: Acme Distribution

Product | Cases | Weight (lbs) | Price/lb | Total Amount
Beef Brisket Boneless 2 110.50 4.20 464.10
Lamb Shoulder Bone-In 1 38.20 5.50 210.10

Balance Due: $674.20
`;

test("parses invoice with non-standard header using generic keyword detection", () => {
  const result = parseSupplierInvoicePdfText({
    text: NONSTANDARD_HEADER_INVOICE,
    sourceFilename: "custom-meats-9001.pdf",
    suppliers: [],
    products: [],
  });

  assert.ok(result.values.lines.length >= 2, "should extract at least 2 lines from non-standard header");
  assert.ok(
    result.unmatchedLineDescriptions.length >= 2,
    "should have unmatched descriptions for both lines",
  );
  const hasBeef = result.unmatchedLineDescriptions.some(d => /beef/i.test(d));
  const hasLamb = result.unmatchedLineDescriptions.some(d => /lamb/i.test(d));
  assert.ok(hasBeef, "should detect Beef Brisket row");
  assert.ok(hasLamb, "should detect Lamb Shoulder row");
});

// ---------------------------------------------------------------------------
// Regression: wider tolerance for catch-weight rounding
// ---------------------------------------------------------------------------

const ROUNDED_AMOUNT_INVOICE = `
Meat Co Invoice
DESCRIPTIONQUANTITYWEIGHTPRICEAMOUNT
Premium Lamb Leg B/I 2cs 350.50 2.89 1013.00
Goat Shoulder 1cs 48.30 5.45 263.00

BALANCE DUE $1,276.00
`;

test("parses catch-weight row where invoice rounds amount (tolerance regression)", () => {
  // 350.50 × 2.89 = 1012.945, invoice shows 1013.00 → delta 0.055 > old 0.02 limit
  // 48.30 × 5.45 = 263.235, invoice shows 263.00 → delta 0.235 > old 0.02 limit
  const result = parseSupplierInvoicePdfText({
    text: ROUNDED_AMOUNT_INVOICE,
    sourceFilename: "meatco-rounding.pdf",
    suppliers: [],
    products: [],
  });

  assert.equal(result.values.lines.length, 2, "should parse both rounded-amount rows");
  const lambLine = result.values.lines[0];
  assert.equal(lambLine.unitType, "catch_weight");
  assert.equal(lambLine.weightLbs, "350.5000");
  assert.equal(lambLine.unitPrice, "2.8900");
});

// ---------------------------------------------------------------------------
// Regression: generic fallback (no header at all)
// ---------------------------------------------------------------------------

const NO_HEADER_INVOICE = `
Fresh Farms Supply
Invoice #55123 Date: 04/30/2026

Chicken Breast BNLS 5cs 200.50 3.10 621.55
Turkey Whole 2cs 85.00 2.75 233.75

Total: $855.30
`;

test("extracts lines via generic fallback when no table header exists", () => {
  const result = parseSupplierInvoicePdfText({
    text: NO_HEADER_INVOICE,
    sourceFilename: "fresh-farms-55123.pdf",
    suppliers: [],
    products: [],
  });

  assert.ok(result.values.lines.length >= 2, "generic fallback should extract at least 2 lines");
  const hasChicken = result.unmatchedLineDescriptions.some(d => /chicken/i.test(d));
  const hasTurkey = result.unmatchedLineDescriptions.some(d => /turkey/i.test(d));
  assert.ok(hasChicken, "generic fallback should detect chicken row");
  assert.ok(hasTurkey, "generic fallback should detect turkey row");
});

// ---------------------------------------------------------------------------
// Regression: merge guard — real det lines must not be overwritten by AI
// ---------------------------------------------------------------------------

test("parseSupplierInvoicePdfText returns real lines even when productId is empty", () => {
  // This test verifies the deterministic parser does return real lines for the Brewer
  // invoice without product matches — the merge fix ensures AI never replaces them.
  const result = parseSupplierInvoicePdfText({
    text: BREWER_INVOICE_TEXT,
    sourceFilename: "brewer-137098.pdf",
    suppliers: [{ id: "supplier-brewer", name: "Brewer Livestock" }],
    products: [], // no products — productId will be ""
  });

  // All 3 inventory lines should be extracted despite no product matches
  assert.equal(result.values.lines.length, 3, "should have 3 real parsed lines");
  assert.ok(
    result.unmatchedLineDescriptions.length === 3,
    "all 3 descriptions should be in unmatchedLineDescriptions",
  );
  // Each line should have real weight and price data
  for (const line of result.values.lines) {
    assert.ok(Number(line.weightLbs) > 0, `line should have weight > 0: ${JSON.stringify(line)}`);
    assert.ok(Number(line.unitPrice) > 0, `line should have price > 0: ${JSON.stringify(line)}`);
  }
});

test("parses Zabiha/Fatima packed catch-weight and fixed-case rows", () => {
  const result = parseSupplierInvoicePdfText({
    text: ZABIHA_INVOICE_TEXT,
    sourceFilename: "Inv_243192_from_Zabiha_Halal_Meat_Processors_50728.pdf",
    suppliers: [{ id: "supplier-zabiha", name: "Zabiha Halal Meat Processors" }],
    products: [
      { id: "product-short-rib", name: "Brisket Short Rib" },
      { id: "product-brisket-point", name: "BEEF PRIME BRISKET POINT EXP" },
      { id: "product-rib-eye", name: "RR RIB EYE" },
      { id: "product-gyros", name: "Fatima Halal Small Cones" },
      { id: "product-ground-beef", name: "Ground Beef 80/20 Lean" },
      { id: "product-blade-eye", name: "BEEF BLADE EYE EXP" },
      { id: "product-chicken-ham", name: "Chicken Ham Deli Sliced" },
      { id: "product-pastrami", name: "Pastrami" },
    ],
  });

  assert.equal(result.values.supplierId, "supplier-zabiha");
  assert.equal(result.values.supplierInvoiceNumber, "243192");
  assert.equal(result.values.invoiceDate, "2026-04-20");
  assert.equal(result.values.lines.length, 9);
  assert.deepEqual(
    result.values.lines.map(line => ({
      productId: line.productId,
      unitType: line.unitType,
      quantityCases: line.quantityCases,
      weightLbs: line.weightLbs,
      unitPrice: line.unitPrice,
    })),
    [
      {
        productId: "product-short-rib",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "56.6000",
        unitPrice: "6.5500",
      },
      {
        productId: "product-short-rib",
        unitType: "catch_weight",
        quantityCases: "2",
        weightLbs: "25.2000",
        unitPrice: "6.5500",
      },
      {
        productId: "product-brisket-point",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "79.1000",
        unitPrice: "5.7500",
      },
      {
        productId: "product-rib-eye",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "15.9000",
        unitPrice: "12.8000",
      },
      {
        productId: "product-gyros",
        unitType: "fixed_case",
        quantityCases: "10",
        weightLbs: "0",
        unitPrice: "143.0000",
      },
      {
        productId: "product-ground-beef",
        unitType: "catch_weight",
        quantityCases: "2",
        weightLbs: "60.5000",
        unitPrice: "4.8900",
      },
      {
        productId: "product-blade-eye",
        unitType: "catch_weight",
        quantityCases: "1",
        weightLbs: "17.7000",
        unitPrice: "5.4000",
      },
      {
        productId: "product-chicken-ham",
        unitType: "fixed_case",
        quantityCases: "1",
        weightLbs: "0",
        unitPrice: "6.0900",
      },
      {
        productId: "product-pastrami",
        unitType: "fixed_case",
        quantityCases: "1",
        weightLbs: "0",
        unitPrice: "8.1900",
      },
    ],
  );
  assert.equal(result.totalComparison.extractedTotal, "3029.85");
  assert.equal(result.totalComparison.computedLineTotal, "3029.85");
  assert.equal(result.totalComparison.matches, true);
});
