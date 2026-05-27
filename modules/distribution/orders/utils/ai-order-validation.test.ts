import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AiOrderExtractionResultSchema,
  buildOrderExtractionUserMessage,
  sanitizeCustomerHint,
  sanitizeUnit,
  truncateOrderText,
  validateOrderExtractionResult,
} from "./ai-order-validation";

// Convenience: a fully-formed model response. Tests mutate clones of this.
// Typed loosely on purpose — the validator accepts unknown input and the
// tests need to shove nulls / negatives into fields without TS fighting.
type RawLine = {
  productHint: string;
  qty: number | null;
  unit: string | null;
  weightLbs: number | null;
  priceHint: number | null;
  notes: string | null;
  confidence: number;
};
type RawPayload = {
  customerHint: string | null;
  requestedDate: string | null;
  lines: RawLine[];
  customerNotes: string | null;
  internalNotes: string | null;
  confidence: number;
  warnings: string[];
  reasoning: string;
};

function validPayload(): RawPayload {
  return {
    customerHint: "City Diner",
    requestedDate: "2026-05-28",
    lines: [
      {
        productHint: "ribeye",
        qty: 20,
        unit: "cs",
        weightLbs: null,
        priceHint: null,
        notes: null,
        confidence: 90,
      },
      {
        productHint: "chicken thigh b/i",
        qty: 5,
        unit: "case",
        weightLbs: null,
        priceHint: null,
        notes: "halal cut",
        confidence: 80,
      },
    ],
    customerNotes: null,
    internalNotes: null,
    confidence: 85,
    warnings: [],
    reasoning: "Direct extraction from clear request.",
  };
}

test("validate passes a clean payload through unchanged", () => {
  const validated = validateOrderExtractionResult(validPayload());
  assert.ok(validated);
  assert.equal(validated.customerHint, "City Diner");
  assert.equal(validated.requestedDate, "2026-05-28");
  assert.equal(validated.lines.length, 2);
  assert.equal(validated.lines[0].productHint, "ribeye");
});

test("schema rejects payloads missing required arrays", () => {
  const bad = { ...validPayload(), lines: undefined };
  const result = AiOrderExtractionResultSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("drops phantom lines: empty productHint", () => {
  const payload = validPayload();
  payload.lines.push({
    productHint: "   ",
    qty: 1,
    unit: null,
    weightLbs: null,
    priceHint: null,
    notes: null,
    confidence: 30,
  });
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.lines.length, 2);
});

test("drops phantom lines: null or non-positive qty", () => {
  const payload = validPayload();
  payload.lines.push({
    productHint: "phantom",
    qty: 0,
    unit: null,
    weightLbs: null,
    priceHint: null,
    notes: null,
    confidence: 30,
  });
  payload.lines.push({
    productHint: "phantom2",
    qty: null,
    unit: null,
    weightLbs: null,
    priceHint: null,
    notes: null,
    confidence: 30,
  });
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.lines.length, 2);
});

test("non-ISO requestedDate is coerced to null", () => {
  const payload = { ...validPayload(), requestedDate: "next Tuesday" };
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.requestedDate, null);
});

test("ISO requestedDate is preserved verbatim", () => {
  const payload = { ...validPayload(), requestedDate: "2026-12-31" };
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.requestedDate, "2026-12-31");
});

test("unit outside the allow-list collapses to null", () => {
  const payload = validPayload();
  payload.lines[0].unit = "boxes-of-cans";
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.lines[0].unit, null);
});

test("negative weights and prices are coerced to null", () => {
  const payload = validPayload();
  payload.lines[0].weightLbs = -10;
  payload.lines[0].priceHint = -1;
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.lines[0].weightLbs, null);
  assert.equal(validated.lines[0].priceHint, null);
});

test("confidence is rounded to a whole number", () => {
  // In-range float: schema accepts, post-validation rounds.
  const payload = { ...validPayload(), confidence: 85.7 };
  const validated = validateOrderExtractionResult(payload);
  assert.ok(validated);
  assert.equal(validated.confidence, 86);
});

test("out-of-range confidence fails schema validation", () => {
  // Defense in depth: a model returning >100 is malfunctioning. Fail loudly
  // rather than silently clamping — caller treats as a parse error.
  const payload = { ...validPayload(), confidence: 150 };
  const validated = validateOrderExtractionResult(payload);
  assert.equal(validated, null);
});

test("customerHint sanitiser rejects numeric tokens", () => {
  assert.equal(sanitizeCustomerHint("123.45"), null);
  assert.equal(sanitizeCustomerHint("$45.00"), null);
  assert.equal(sanitizeCustomerHint("X"), null);
  assert.equal(sanitizeCustomerHint("City Diner"), "City Diner");
  assert.equal(sanitizeCustomerHint("  Halal Grill  "), "Halal Grill");
  assert.equal(sanitizeCustomerHint(null), null);
});

test("unit sanitiser is case-insensitive but preserves casing", () => {
  assert.equal(sanitizeUnit("CASE"), "CASE");
  assert.equal(sanitizeUnit("lb"), "lb");
  assert.equal(sanitizeUnit("widget"), null);
  assert.equal(sanitizeUnit(""), null);
  assert.equal(sanitizeUnit(null), null);
});

test("truncateOrderText keeps the tail when over budget", () => {
  const long = "a".repeat(100) + "TAIL_CONTENT";
  const truncated = truncateOrderText(long, 20);
  assert.equal(truncated.length, 20);
  assert.ok(truncated.endsWith("TAIL_CONTENT"));
});

test("truncateOrderText is a no-op when under budget", () => {
  const short = "hello world";
  assert.equal(truncateOrderText(short, 100), short);
});

test("buildOrderExtractionUserMessage includes today, candidates, and the message", () => {
  const message = buildOrderExtractionUserMessage({
    rawText: "20 cases ribeye please",
    today: "2026-05-26",
    candidateCustomers: [{ id: "c1", name: "City Diner" }],
    candidateProducts: [{ id: "p1", name: "Ribeye Steak", sku: "RBY-001" }],
  });
  assert.ok(message.includes("Today is 2026-05-26"));
  assert.ok(message.includes("City Diner"));
  assert.ok(message.includes("Ribeye Steak (sku: RBY-001)"));
  assert.ok(message.includes("20 cases ribeye please"));
});

test("buildOrderExtractionUserMessage handles empty candidate lists gracefully", () => {
  const message = buildOrderExtractionUserMessage({
    rawText: "test",
    today: "2026-05-26",
    candidateCustomers: [],
    candidateProducts: [],
  });
  assert.ok(message.includes("(none — propose a new customer or leave null)"));
  assert.ok(message.includes("(none — leave productHint as the customer's verbatim phrase)"));
});

test("validator backfills missing optional line fields rather than rejecting", () => {
  // Simulate an older fixture / loose prompt that only emitted required fields.
  const loosePayload = {
    customerHint: "City Diner",
    requestedDate: null,
    lines: [
      {
        productHint: "ribeye",
        qty: 20,
        // missing: unit, weightLbs, priceHint, notes, confidence
      },
    ],
    customerNotes: null,
    internalNotes: null,
    confidence: 50,
    // missing: warnings, reasoning
  };
  const validated = validateOrderExtractionResult(loosePayload);
  assert.ok(validated);
  assert.equal(validated.lines[0].confidence, 0);
  assert.deepEqual(validated.warnings, []);
});
