import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateAiCostMicros,
  formatAiUsageCost,
  isKnownModel,
  KNOWN_MODELS,
} from "./ai-cost";

// ---------------------------------------------------------------------------
// calculateAiCostMicros — verifies the integer-micros math + price table
// ---------------------------------------------------------------------------

test("calculateAiCostMicros: gpt-4o-mini priced at $0.15/$0.60 per 1M tokens", () => {
  // 1000 input + 1000 output → 1000 × 0.15 + 1000 × 0.60 = 150 + 600 = 750 micros
  // (USD per 1M tokens × tokens, kept in micros so we never store floats).
  const cost = calculateAiCostMicros({
    model: "gpt-4o-mini",
    promptTokens: 1000,
    completionTokens: 1000,
  });
  assert.equal(cost, 750);
});

test("calculateAiCostMicros: gpt-4o priced at $2.50/$10.00 per 1M tokens", () => {
  const cost = calculateAiCostMicros({
    model: "gpt-4o",
    promptTokens: 1000,
    completionTokens: 1000,
  });
  assert.equal(cost, 12500); // 1000×2.5 + 1000×10 = 2500 + 10000 = 12500
});

test("calculateAiCostMicros: typical small invoice on mini ≈ $0.0018", () => {
  // 4K input + 1K output is the user's typical workload (3-8 lines).
  // Expected: 4000 × 0.15 + 1000 × 0.60 = 600 + 600 = 1200 micros = $0.0012.
  const cost = calculateAiCostMicros({
    model: "gpt-4o-mini",
    promptTokens: 4000,
    completionTokens: 1000,
  });
  assert.equal(cost, 1200);
});

test("calculateAiCostMicros: typical 100-line invoice on gpt-4o ≈ $0.10", () => {
  // 5.5K input + 9K output is the observed multipage shape.
  // Expected: 5500 × 2.5 + 9000 × 10 = 13750 + 90000 = 103750 micros = $0.10375.
  const cost = calculateAiCostMicros({
    model: "gpt-4o",
    promptTokens: 5500,
    completionTokens: 9000,
  });
  assert.equal(cost, 103750);
});

test("calculateAiCostMicros: unknown model → 0 (don't invent prices)", () => {
  const cost = calculateAiCostMicros({
    model: "claude-3-opus-imaginary",
    promptTokens: 1000,
    completionTokens: 1000,
  });
  assert.equal(cost, 0);
});

test("calculateAiCostMicros: zero tokens → 0", () => {
  const cost = calculateAiCostMicros({
    model: "gpt-4o-mini",
    promptTokens: 0,
    completionTokens: 0,
  });
  assert.equal(cost, 0);
});

test("calculateAiCostMicros: returns integer (rounds, never fractional)", () => {
  // 333 input × 0.15/1M × 1M/M = 49.95 micros → round to 50
  const cost = calculateAiCostMicros({
    model: "gpt-4o-mini",
    promptTokens: 333,
    completionTokens: 0,
  });
  assert.ok(Number.isInteger(cost), "cost is integer micros");
});

// ---------------------------------------------------------------------------
// formatAiUsageCost — display formatting
// ---------------------------------------------------------------------------

test("formatAiUsageCost: zero → '$0'", () => {
  assert.equal(formatAiUsageCost(0), "$0");
});

test("formatAiUsageCost: sub-cent → 6 decimal places", () => {
  // Avoid rounding to $0.00 — admin needs to see the actual sub-cent cost.
  assert.equal(formatAiUsageCost(1200), "$0.001200");
});

test("formatAiUsageCost: cents → 4 decimal places", () => {
  // Per-row cost: still want precision below cent.
  assert.equal(formatAiUsageCost(15000), "$0.0150");
});

test("formatAiUsageCost: dollars → locale currency", () => {
  // 1.234 USD = 1,234,000 micros
  assert.equal(formatAiUsageCost(1_234_000), "$1.23");
});

test("formatAiUsageCost: thousands → comma separator", () => {
  assert.equal(formatAiUsageCost(1_234_000_000), "$1,234.00");
});

// ---------------------------------------------------------------------------
// isKnownModel / KNOWN_MODELS — pricing-table introspection
// ---------------------------------------------------------------------------

test("isKnownModel: covers the production defaults", () => {
  // These two are the production defaults + escalation target. If either
  // drops out of the pricing table the admin page will show $0 for that
  // model, which would be a regression.
  assert.equal(isKnownModel("gpt-4o-mini"), true);
  assert.equal(isKnownModel("gpt-4o"), true);
});

test("isKnownModel: returns false for unknown model", () => {
  assert.equal(isKnownModel("unknown-model"), false);
});

test("KNOWN_MODELS: lists every model in the pricing table", () => {
  // Sanity check — used by the admin page to display "we know the cost
  // for these models" docs.
  assert.ok(KNOWN_MODELS.includes("gpt-4o-mini"));
  assert.ok(KNOWN_MODELS.includes("gpt-4o"));
  assert.ok(KNOWN_MODELS.length >= 2);
});
