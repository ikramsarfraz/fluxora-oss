import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RECEIPT_EXTRACTION_SYSTEM_PROMPT,
  ReceiptExtractionPayloadSchema,
  buildReceiptUserMessage,
  validateReceiptPayload,
} from "./receipt-vision-prompts";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

test("ReceiptExtractionPayloadSchema accepts a fully-populated success payload", () => {
  const result = ReceiptExtractionPayloadSchema.safeParse({
    vendorName: "Shell",
    transactionDate: "2026-05-14",
    totalAmount: "42.18",
    currency: "USD",
    paymentMethodHint: "card",
    confidence: 88,
    reasoning: "Clear receipt header.",
  });
  assert.equal(result.success, true);
});

test("ReceiptExtractionPayloadSchema accepts an all-null payload (failed read)", () => {
  // The strict-mode schema requires every key — the model returns nulls when
  // it can't read a field, not omitted keys.
  const result = ReceiptExtractionPayloadSchema.safeParse({
    vendorName: null,
    transactionDate: null,
    totalAmount: null,
    currency: null,
    paymentMethodHint: null,
    confidence: 0,
    reasoning: "Receipt is blurry; no fields readable.",
  });
  assert.equal(result.success, true);
});

test("ReceiptExtractionPayloadSchema rejects an unknown paymentMethodHint", () => {
  const result = ReceiptExtractionPayloadSchema.safeParse({
    vendorName: "Costco",
    transactionDate: "2026-05-14",
    totalAmount: "180.00",
    currency: "USD",
    paymentMethodHint: "crypto", // not in the enum
    confidence: 80,
    reasoning: "",
  });
  assert.equal(result.success, false);
});

test("ReceiptExtractionPayloadSchema rejects confidence outside 0-100", () => {
  const result = ReceiptExtractionPayloadSchema.safeParse({
    vendorName: null,
    transactionDate: null,
    totalAmount: null,
    currency: null,
    paymentMethodHint: null,
    confidence: 150,
    reasoning: "",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// validateReceiptPayload — post-validation shaping
// ---------------------------------------------------------------------------

test("validateReceiptPayload nulls a non-ISO transactionDate instead of failing", () => {
  // Defensive: model occasionally returns "May 2026" / "2026-05" even when
  // told to use ISO. Drop the bad value, keep the rest of the payload.
  const result = validateReceiptPayload({
    vendorName: "Acme",
    transactionDate: "May 14, 2026",
    totalAmount: "42.18",
    currency: "USD",
    paymentMethodHint: "card",
    confidence: 75,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.transactionDate, null);
  assert.equal(result.totalAmount, "42.18");
});

test("validateReceiptPayload strips commas from amounts and re-validates", () => {
  const result = validateReceiptPayload({
    vendorName: "Acme",
    transactionDate: "2026-05-14",
    totalAmount: "1,234.56",
    currency: "USD",
    paymentMethodHint: null,
    confidence: 75,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.totalAmount, "1234.56");
});

test("validateReceiptPayload nulls a non-numeric total instead of failing", () => {
  const result = validateReceiptPayload({
    vendorName: "Acme",
    transactionDate: "2026-05-14",
    totalAmount: "$42.18 (paid)",
    currency: "USD",
    paymentMethodHint: null,
    confidence: 75,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.totalAmount, null);
});

test("validateReceiptPayload nulls a negative total", () => {
  // Refunds shouldn't auto-prefill — they need explicit handling. Drop the
  // value so the form stays empty and the user notices.
  const result = validateReceiptPayload({
    vendorName: "Acme",
    transactionDate: "2026-05-14",
    totalAmount: "-12.00",
    currency: "USD",
    paymentMethodHint: null,
    confidence: 75,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.totalAmount, null);
});

test("validateReceiptPayload collapses whitespace in vendorName", () => {
  const result = validateReceiptPayload({
    vendorName: "  Shell  Gas    Station  ",
    transactionDate: "2026-05-14",
    totalAmount: "42.18",
    currency: "USD",
    paymentMethodHint: "card",
    confidence: 80,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.vendorName, "Shell Gas Station");
});

test("validateReceiptPayload nulls an empty-after-trim vendorName", () => {
  const result = validateReceiptPayload({
    vendorName: "   ",
    transactionDate: "2026-05-14",
    totalAmount: "42.18",
    currency: "USD",
    paymentMethodHint: null,
    confidence: 60,
    reasoning: "",
  });
  assert.ok(result);
  assert.equal(result.vendorName, null);
});

test("validateReceiptPayload returns null when the payload is shape-invalid", () => {
  const result = validateReceiptPayload({ vendorName: 42 });
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// buildReceiptUserMessage
// ---------------------------------------------------------------------------

test("buildReceiptUserMessage includes the filename + JSON instruction", () => {
  const message = buildReceiptUserMessage({ filename: "receipt-acme-may.pdf" });
  assert.ok(message.includes("receipt-acme-may.pdf"));
  assert.ok(message.toLowerCase().includes("json"));
});

test("RECEIPT_EXTRACTION_SYSTEM_PROMPT mentions the four core fields", () => {
  // Sanity check: the prompt must reference each field name the schema
  // expects, otherwise the model gets confused about what to return.
  const prompt = RECEIPT_EXTRACTION_SYSTEM_PROMPT;
  assert.ok(prompt.includes("vendorName"));
  assert.ok(prompt.includes("transactionDate"));
  assert.ok(prompt.includes("totalAmount"));
  assert.ok(prompt.includes("paymentMethodHint"));
});
