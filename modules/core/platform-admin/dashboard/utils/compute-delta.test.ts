import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDelta } from "./compute-delta";

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

test("up: current > prior", () => {
  const result = computeDelta({ current: 12, prior: 8 });
  assert.equal(result.direction, "up");
  assert.equal(result.diff, 4);
});

test("down: current < prior", () => {
  const result = computeDelta({ current: 3, prior: 10 });
  assert.equal(result.direction, "down");
  assert.equal(result.diff, -7);
});

test("flat: current === prior (non-zero)", () => {
  const result = computeDelta({ current: 5, prior: 5 });
  assert.equal(result.direction, "flat");
  assert.equal(result.diff, 0);
});

test("flat: both zero", () => {
  const result = computeDelta({ current: 0, prior: 0 });
  assert.equal(result.direction, "flat");
  assert.equal(result.diff, 0);
});

// ---------------------------------------------------------------------------
// Percentage
// ---------------------------------------------------------------------------

test("pct: prior > 0 produces an integer percentage", () => {
  // 4 / 8 = 0.5 → 50%
  const result = computeDelta({ current: 12, prior: 8 });
  assert.equal(result.pct, 50);
});

test("pct: rounding to the nearest integer (Math.round, half-up)", () => {
  // 1 / 3 = 0.333… → 33%
  assert.equal(computeDelta({ current: 4, prior: 3 }).pct, 33);
  // 2 / 3 = 0.666… → 67% (rounds up at 0.5)
  assert.equal(computeDelta({ current: 5, prior: 3 }).pct, 67);
});

test("pct: negative diff yields a negative percentage", () => {
  // -7 / 10 = -0.7 → -70%
  const result = computeDelta({ current: 3, prior: 10 });
  assert.equal(result.pct, -70);
});

test("pct: doubling prior yields 100%", () => {
  const result = computeDelta({ current: 20, prior: 10 });
  assert.equal(result.pct, 100);
});

test("pct: equal values yield 0", () => {
  const result = computeDelta({ current: 7, prior: 7 });
  assert.equal(result.pct, 0);
});

// ---------------------------------------------------------------------------
// Zero-prior guard — the dashboard would otherwise render "+∞%"
// ---------------------------------------------------------------------------

test("pct: prior is 0 and current is 0 → null (no defined percentage)", () => {
  const result = computeDelta({ current: 0, prior: 0 });
  assert.equal(result.pct, null);
  assert.equal(result.direction, "flat");
});

test("pct: prior is 0 and current > 0 → null (avoid +∞%)", () => {
  const result = computeDelta({ current: 12, prior: 0 });
  assert.equal(result.pct, null);
  assert.equal(result.direction, "up");
  assert.equal(result.diff, 12);
});

test("pct: negative prior treated as no defined percentage", () => {
  // Counts shouldn't be negative in practice, but if a bad row sneaks
  // through we still want a safe (null) result rather than a misleading
  // "down 1000%" indicator.
  const result = computeDelta({ current: 5, prior: -3 });
  assert.equal(result.pct, null);
});

// ---------------------------------------------------------------------------
// Shape — make sure the consumer can destructure all three fields
// ---------------------------------------------------------------------------

test("result is always { diff, direction, pct } with stable shape", () => {
  const result = computeDelta({ current: 1, prior: 2 });
  assert.deepEqual(Object.keys(result).sort(), ["diff", "direction", "pct"]);
});
