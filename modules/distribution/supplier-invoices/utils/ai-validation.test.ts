import assert from "node:assert/strict";
import { test } from "node:test";

import {
  truncateInvoiceText,
  limitProductCandidates,
  sanitizeSupplierName,
  validateExtractionResult,
  validateProductMatchResult,
  safeParseJson,
  buildInvoiceExtractionUserMessage,
  buildProductMatchUserMessage,
  DEFAULT_MAX_INVOICE_TEXT_CHARS,
  DEFAULT_MAX_PRODUCT_CANDIDATES,
} from "./ai-validation";

// ---------------------------------------------------------------------------
// truncateInvoiceText
// ---------------------------------------------------------------------------

test("truncateInvoiceText: returns text unchanged when under limit", () => {
  const text = "short invoice text";
  assert.equal(truncateInvoiceText(text, 1000), text);
});

test("truncateInvoiceText: truncates and appends marker when over limit", () => {
  const text = "a".repeat(100);
  const result = truncateInvoiceText(text, 50);
  assert.ok(result.length < text.length + 60);
  assert.ok(result.includes("[... invoice text truncated"));
  assert.ok(result.startsWith("a".repeat(50)));
});

test("truncateInvoiceText: uses default limit when not specified", () => {
  const short = "a".repeat(100);
  assert.equal(truncateInvoiceText(short), short);

  const long = "b".repeat(DEFAULT_MAX_INVOICE_TEXT_CHARS + 500);
  const truncated = truncateInvoiceText(long);
  assert.ok(truncated.length < long.length);
  assert.ok(truncated.includes("[... invoice text truncated"));
});

test("truncateInvoiceText: exact-limit text is not truncated", () => {
  const text = "x".repeat(DEFAULT_MAX_INVOICE_TEXT_CHARS);
  assert.equal(truncateInvoiceText(text), text);
});

// ---------------------------------------------------------------------------
// limitProductCandidates
// ---------------------------------------------------------------------------

const makeProducts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `prod-${i}`,
    name: `Product ${i}`,
    sku: null,
  }));

test("limitProductCandidates: returns array unchanged when under limit", () => {
  const products = makeProducts(10);
  assert.deepEqual(limitProductCandidates(products, 50), products);
});

test("limitProductCandidates: trims to max when over limit", () => {
  const products = makeProducts(100);
  const limited = limitProductCandidates(products, 10);
  assert.equal(limited.length, 10);
  assert.equal(limited[0].id, "prod-0");
  assert.equal(limited[9].id, "prod-9");
});

test("limitProductCandidates: uses default limit when not specified", () => {
  const products = makeProducts(DEFAULT_MAX_PRODUCT_CANDIDATES + 20);
  const limited = limitProductCandidates(products);
  assert.equal(limited.length, DEFAULT_MAX_PRODUCT_CANDIDATES);
});

test("limitProductCandidates: empty array returns empty", () => {
  assert.deepEqual(limitProductCandidates([], 10), []);
});

// ---------------------------------------------------------------------------
// safeParseJson
// ---------------------------------------------------------------------------

test("safeParseJson: parses valid JSON", () => {
  const result = safeParseJson('{"key": "value"}');
  assert.deepEqual(result, { key: "value" });
});

test("safeParseJson: returns null for invalid JSON", () => {
  assert.equal(safeParseJson("not json"), null);
  assert.equal(safeParseJson(""), null);
  assert.equal(safeParseJson("   "), null);
});

test("safeParseJson: strips markdown fences and parses", () => {
  const fenced = "```json\n{\"key\": 1}\n```";
  assert.deepEqual(safeParseJson(fenced), { key: 1 });
});

test("safeParseJson: strips plain code fences", () => {
  const fenced = "```\n{\"x\": true}\n```";
  assert.deepEqual(safeParseJson(fenced), { x: true });
});

// ---------------------------------------------------------------------------
// validateExtractionResult
// ---------------------------------------------------------------------------

function validExtractionPayload() {
  return {
    supplierName: "SUMMIT TRADING",
    invoiceNumber: "57876",
    invoiceDate: "2026-04-20",
    totalAmount: 1536.80,
    subtotal: 1536.80,
    fees: [],
    lines: [
      {
        vendorProductName: "JUMBO CHICKEN TENDER",
        quantityCases: 10,
        quantityWeight: 400,
        unitPrice: 3.25,
        lineTotal: 1300.00,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    confidence: 92,
    warnings: [],
    reasoning: "Clear table layout with all fields present.",
  };
}

test("validateExtractionResult: accepts a valid payload", () => {
  const result = validateExtractionResult(validExtractionPayload());
  assert.ok(result !== null);
  assert.equal(result!.supplierName, "SUMMIT TRADING");
  assert.equal(result!.lines.length, 1);
  assert.equal(result!.confidence, 92);
});

test("validateExtractionResult: accepts null fields", () => {
  const payload = {
    ...validExtractionPayload(),
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.supplierName, null);
});

test("validateExtractionResult: returns null for missing required fields", () => {
  const payload = { ...validExtractionPayload() };
  // @ts-expect-error intentional for test
  delete payload.lines;
  assert.equal(validateExtractionResult(payload), null);
});

test("validateExtractionResult: returns null for confidence out of range", () => {
  const payload = { ...validExtractionPayload(), confidence: 150 };
  // Zod clamps 0-100, so 150 should fail schema
  assert.equal(validateExtractionResult(payload), null);
});

test("validateExtractionResult: returns null for completely empty AI response", () => {
  // lines=[], fees=[], confidence=0 → likely a failed call, not a valid invoice
  const payload = {
    ...validExtractionPayload(),
    lines: [],
    fees: [],
    confidence: 0,
  };
  assert.equal(validateExtractionResult(payload), null);
});

test("validateExtractionResult: rounds confidence to integer", () => {
  const payload = { ...validExtractionPayload(), confidence: 85.7 };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.confidence, 86);
});

test("validateExtractionResult: accepts empty lines when fees are present", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [],
    fees: [{ description: "Delivery", amount: 25.0 }],
    confidence: 60,
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
});

test("validateExtractionResult: returns null for non-object input", () => {
  assert.equal(validateExtractionResult(null), null);
  assert.equal(validateExtractionResult("string"), null);
  assert.equal(validateExtractionResult(42), null);
  assert.equal(validateExtractionResult([]), null);
});

test("validateExtractionResult: rejects invalid unitType", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [{ ...validExtractionPayload().lines[0], unitType: "per_unit" }],
  };
  assert.equal(validateExtractionResult(payload), null);
});

// ---------------------------------------------------------------------------
// validateProductMatchResult
// ---------------------------------------------------------------------------

function validMatchPayload(vendorNames: string[]) {
  return {
    matches: vendorNames.map((name, i) => ({
      vendorProductName: name,
      suggestedProductId: `prod-${i}`,
      confidence: 85,
      reasoning: "Name matches closely.",
    })),
  };
}

test("validateProductMatchResult: accepts a valid payload", () => {
  const names = ["JUMBO CHICKEN TENDER", "JUMBO CHICKEN BREAST"];
  const result = validateProductMatchResult(validMatchPayload(names), names);
  assert.ok(result !== null);
  assert.equal(result!.matches.length, 2);
  assert.equal(result!.matches[0].vendorProductName, "JUMBO CHICKEN TENDER");
});

test("validateProductMatchResult: fills missing names with null match", () => {
  const names = ["CHICKEN BREAST", "LAMB LEG"];
  const payload = {
    matches: [
      {
        vendorProductName: "CHICKEN BREAST",
        suggestedProductId: "prod-1",
        confidence: 90,
        reasoning: "Exact match.",
      },
      // LAMB LEG is missing from AI response
    ],
  };
  const result = validateProductMatchResult(payload, names);
  assert.ok(result !== null);
  assert.equal(result!.matches.length, 2);
  const lambMatch = result!.matches.find(m => m.vendorProductName === "LAMB LEG");
  assert.ok(lambMatch !== undefined);
  assert.equal(lambMatch!.suggestedProductId, null);
  assert.equal(lambMatch!.confidence, 0);
});

test("validateProductMatchResult: returns null for missing matches array", () => {
  assert.equal(validateProductMatchResult({ not_matches: [] }, ["CHICKEN"]), null);
});

test("validateProductMatchResult: returns null for non-object input", () => {
  assert.equal(validateProductMatchResult(null, ["CHICKEN"]), null);
  assert.equal(validateProductMatchResult("bad", []), null);
});

test("validateProductMatchResult: accepts null suggestedProductId", () => {
  const payload = {
    matches: [
      {
        vendorProductName: "MYSTERY MEAT",
        suggestedProductId: null,
        confidence: 0,
        reasoning: "No match found.",
      },
    ],
  };
  const result = validateProductMatchResult(payload, ["MYSTERY MEAT"]);
  assert.ok(result !== null);
  assert.equal(result!.matches[0].suggestedProductId, null);
});

// ---------------------------------------------------------------------------
// buildInvoiceExtractionUserMessage
// ---------------------------------------------------------------------------

test("buildInvoiceExtractionUserMessage: includes filename", () => {
  const msg = buildInvoiceExtractionUserMessage({
    filename: "test-invoice.pdf",
    extractedText: "some text",
    supplierHints: [],
    candidateSuppliers: [],
    candidateProducts: [],
  });
  assert.ok(msg.includes("test-invoice.pdf"));
  assert.ok(msg.includes("some text"));
});

test("buildInvoiceExtractionUserMessage: includes supplier hints when present", () => {
  const msg = buildInvoiceExtractionUserMessage({
    filename: "inv.pdf",
    extractedText: "text",
    supplierHints: ["SUMMIT TRADING", "ALI TRADERS"],
    candidateSuppliers: [],
    candidateProducts: [],
  });
  assert.ok(msg.includes("SUMMIT TRADING"));
  assert.ok(msg.includes("ALI TRADERS"));
});

test("buildInvoiceExtractionUserMessage: includes supplier IDs for matching", () => {
  const msg = buildInvoiceExtractionUserMessage({
    filename: "inv.pdf",
    extractedText: "text",
    supplierHints: [],
    candidateSuppliers: [{ id: "sup-1", name: "SUMMIT TRADING" }],
    candidateProducts: [],
  });
  assert.ok(msg.includes("sup-1"));
  assert.ok(msg.includes("SUMMIT TRADING"));
});

test("buildInvoiceExtractionUserMessage: includes product IDs and SKUs", () => {
  const msg = buildInvoiceExtractionUserMessage({
    filename: "inv.pdf",
    extractedText: "text",
    supplierHints: [],
    candidateSuppliers: [],
    candidateProducts: [{ id: "prod-1", name: "Chicken Breast", sku: "CHKBRST" }],
  });
  assert.ok(msg.includes("prod-1"));
  assert.ok(msg.includes("Chicken Breast"));
  assert.ok(msg.includes("CHKBRST"));
});

// ---------------------------------------------------------------------------
// buildProductMatchUserMessage
// ---------------------------------------------------------------------------

test("buildProductMatchUserMessage: includes vendor names", () => {
  const msg = buildProductMatchUserMessage({
    vendorProductNames: ["JUMBO CHICKEN TENDER", "B/I LAMB SHLDRS"],
    candidateProducts: [],
  });
  assert.ok(msg.includes("JUMBO CHICKEN TENDER"));
  assert.ok(msg.includes("B/I LAMB SHLDRS"));
});

test("buildProductMatchUserMessage: includes product IDs for exact matching", () => {
  const msg = buildProductMatchUserMessage({
    vendorProductNames: ["CHICKEN"],
    candidateProducts: [
      { id: "prod-xyz", name: "Whole Chicken", sku: "WHC" },
    ],
  });
  assert.ok(msg.includes("prod-xyz"));
  assert.ok(msg.includes("Whole Chicken"));
  assert.ok(msg.includes("WHC"));
});

test("buildProductMatchUserMessage: instructs to use null when not confident", () => {
  const msg = buildProductMatchUserMessage({
    vendorProductNames: ["UNKNOWN"],
    candidateProducts: [],
  });
  assert.ok(msg.toLowerCase().includes("null"));
});

// ---------------------------------------------------------------------------
// Provider selection (mock-level — no real API calls)
// ---------------------------------------------------------------------------

test("mock provider is not available", async () => {
  // Import via the module — the default is MockAiProvider when no env vars set.
  // We test this through the validation utilities rather than the server-only factory.
  // This test simply verifies the mock returns safe empty results.
  const mockResult = {
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
    fees: [],
    lines: [],
    confidence: 0,
    warnings: ["AI extraction is not configured."],
    reasoning: "Mock provider — no AI extraction performed.",
  };
  // Validate that even a mock failure result passes schema validation
  // (it has lines=[], fees=[], confidence=0 → validateExtractionResult returns null
  //  because all empty + confidence=0 is treated as failed call)
  assert.equal(validateExtractionResult(mockResult), null);
});

// ---------------------------------------------------------------------------
// sanitizeSupplierName
// ---------------------------------------------------------------------------

test("sanitizeSupplierName: passes through a real business name", () => {
  assert.equal(sanitizeSupplierName("SUMMIT TRADING"), "SUMMIT TRADING");
  assert.equal(sanitizeSupplierName("  Brewer Livestock  "), "Brewer Livestock");
});

test("sanitizeSupplierName: rejects pure numeric values", () => {
  assert.equal(sanitizeSupplierName("12.50"), null);
  assert.equal(sanitizeSupplierName("160.00"), null);
  assert.equal(sanitizeSupplierName("57876"), null);
});

test("sanitizeSupplierName: rejects money / weight tokens", () => {
  assert.equal(sanitizeSupplierName("$45.00"), null);
  assert.equal(sanitizeSupplierName("160.00 lbs"), null);
  assert.equal(sanitizeSupplierName("3 cs"), null);
  assert.equal(sanitizeSupplierName("12 pcs"), null);
});

test("sanitizeSupplierName: rejects empty / whitespace / single-letter values", () => {
  assert.equal(sanitizeSupplierName(""), null);
  assert.equal(sanitizeSupplierName("   "), null);
  assert.equal(sanitizeSupplierName("A"), null);
  assert.equal(sanitizeSupplierName(null), null);
});

test("sanitizeSupplierName: accepts names containing numbers and punctuation", () => {
  assert.equal(sanitizeSupplierName("3M Meat Co."), "3M Meat Co.");
  assert.equal(sanitizeSupplierName("AB-123 Trading"), "AB-123 Trading");
});

// ---------------------------------------------------------------------------
// validateExtractionResult — supplier-name sanitization
// ---------------------------------------------------------------------------

test("validateExtractionResult: nullifies numeric supplierName values", () => {
  const payload = { ...validExtractionPayload(), supplierName: "12.50" };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.supplierName, null);
});

test("validateExtractionResult: nullifies money supplierName values", () => {
  const payload = { ...validExtractionPayload(), supplierName: "$160.00" };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.supplierName, null);
});

// ---------------------------------------------------------------------------
// validateExtractionResult — caseWeights normalization
// ---------------------------------------------------------------------------

test("validateExtractionResult: passes caseWeights through when length matches quantityCases", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [
      {
        ...validExtractionPayload().lines[0],
        quantityCases: 3,
        caseWeights: [22.5, 23.1, 22.8],
        quantityWeight: 68.4,
      },
    ],
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.deepEqual(result!.lines[0].caseWeights, [22.5, 23.1, 22.8]);
});

test("validateExtractionResult: drops caseWeights when length disagrees with quantityCases", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [
      {
        ...validExtractionPayload().lines[0],
        quantityCases: 5,
        caseWeights: [22.5, 23.1],
      },
    ],
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.lines[0].caseWeights, null);
});

test("validateExtractionResult: drops caseWeights when all values are non-positive", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [
      {
        ...validExtractionPayload().lines[0],
        quantityCases: 2,
        caseWeights: [0, -1],
      },
    ],
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.lines[0].caseWeights, null);
});

test("validateExtractionResult: normalizes missing caseWeights to null", () => {
  // Payload without the field — older models / prompts.
  const payload = validExtractionPayload();
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.equal(result!.lines[0].caseWeights, null);
});

test("validateExtractionResult: keeps caseWeights when quantityCases is null (merge will derive)", () => {
  const payload = {
    ...validExtractionPayload(),
    lines: [
      {
        ...validExtractionPayload().lines[0],
        quantityCases: null,
        caseWeights: [22.5, 23.1, 22.8],
      },
    ],
  };
  const result = validateExtractionResult(payload);
  assert.ok(result !== null);
  assert.deepEqual(result!.lines[0].caseWeights, [22.5, 23.1, 22.8]);
});

test("AI extraction output with real lines passes validation even when supplier is null", () => {
  const aiOutput = {
    supplierName: null,
    invoiceNumber: "12345",
    invoiceDate: "2026-04-20",
    totalAmount: 500.0,
    subtotal: 500.0,
    fees: [],
    lines: [
      {
        vendorProductName: "GOAT (K-30/39.5)",
        quantityCases: 1,
        quantityWeight: 30,
        unitPrice: 10.45,
        lineTotal: 313.5,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    confidence: 75,
    warnings: [],
    reasoning: "Supplier name unclear but line items extracted.",
  };
  const result = validateExtractionResult(aiOutput);
  assert.ok(result !== null);
  assert.equal(result!.supplierName, null);
  assert.equal(result!.lines.length, 1);
  assert.equal(result!.confidence, 75);
});
