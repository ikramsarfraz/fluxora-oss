import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AI_SPEND_BLOCK_RATIO,
  AI_SPEND_WARN_RATIO,
  AiSpendCapError,
  decideAiSpendStatus,
} from "./ai-spend-cap";

// ---------------------------------------------------------------------------
// decideAiSpendStatus — band classification
// ---------------------------------------------------------------------------

test("decideAiSpendStatus: usage well under the warn band is 'ok'", () => {
  const d = decideAiSpendStatus({ usedMicros: 1_000_000, limitMicros: 10_000_000 });
  assert.equal(d.status, "ok");
  assert.equal(d.ratio, 0.1);
});

test("decideAiSpendStatus: usage at exactly the warn threshold flips to 'warn'", () => {
  // Boundary is inclusive — 80% counts as warn, not ok. Pin via the
  // public constant so a future tweak to the threshold updates the test
  // in lockstep.
  const limit = 10_000_000;
  const d = decideAiSpendStatus({
    usedMicros: Math.floor(limit * AI_SPEND_WARN_RATIO),
    limitMicros: limit,
  });
  assert.equal(d.status, "warn");
});

test("decideAiSpendStatus: usage between warn and block stays 'warn'", () => {
  // 90% of $10 = $9, between the 80% warn and 100% block lines.
  const d = decideAiSpendStatus({ usedMicros: 9_000_000, limitMicros: 10_000_000 });
  assert.equal(d.status, "warn");
});

test("decideAiSpendStatus: usage at exactly the block threshold is 'blocked'", () => {
  const limit = 10_000_000;
  const d = decideAiSpendStatus({
    usedMicros: Math.floor(limit * AI_SPEND_BLOCK_RATIO),
    limitMicros: limit,
  });
  assert.equal(d.status, "blocked");
});

test("decideAiSpendStatus: usage above the limit is still 'blocked' (not 'over')", () => {
  // We don't ladder beyond block — once you're capped you stay capped.
  const d = decideAiSpendStatus({ usedMicros: 50_000_000, limitMicros: 10_000_000 });
  assert.equal(d.status, "blocked");
  assert.equal(d.ratio, 5);
});

// ---------------------------------------------------------------------------
// Unlimited / degenerate inputs
// ---------------------------------------------------------------------------

test("decideAiSpendStatus: UNLIMITED limit collapses to 'ok' with null ratio", () => {
  const d = decideAiSpendStatus({
    usedMicros: 999_999_999,
    limitMicros: Number.POSITIVE_INFINITY,
  });
  assert.equal(d.status, "ok");
  assert.equal(d.ratio, null);
});

test("decideAiSpendStatus: limit of 0 is treated as no cap (defensive)", () => {
  // A plan accidentally configured with zero shouldn't lock out every
  // parse. The dashboard would still surface the warn band via its own
  // computation, but the action-layer gate stays permissive — surprising
  // a user with hard blocks because their plan row was misconfigured is
  // worse than letting AI through during a misconfiguration window.
  const d = decideAiSpendStatus({ usedMicros: 1_000_000, limitMicros: 0 });
  assert.equal(d.status, "ok");
  assert.equal(d.ratio, null);
});

test("decideAiSpendStatus: negative limit is treated as no cap", () => {
  const d = decideAiSpendStatus({ usedMicros: 1_000_000, limitMicros: -1 });
  assert.equal(d.status, "ok");
  assert.equal(d.ratio, null);
});

test("decideAiSpendStatus: NaN limit is treated as no cap", () => {
  const d = decideAiSpendStatus({
    usedMicros: 1_000_000,
    limitMicros: Number.NaN,
  });
  assert.equal(d.status, "ok");
});

test("decideAiSpendStatus: negative usage is clamped to 0", () => {
  // Impossible from real data; guards against a writer regression that
  // emits a refund row with a negative cost. Don't let it bypass the
  // cap by going below zero.
  const d = decideAiSpendStatus({ usedMicros: -100, limitMicros: 10_000_000 });
  assert.equal(d.status, "ok");
  assert.equal(d.usedMicros, 0);
});

// ---------------------------------------------------------------------------
// AiSpendCapError
// ---------------------------------------------------------------------------

test("AiSpendCapError: carries the decision + a human-readable message", () => {
  const decision = decideAiSpendStatus({
    usedMicros: 10_500_000,
    limitMicros: 10_000_000,
  });
  const err = new AiSpendCapError(decision);
  assert.equal(err.code, "ai_spend_capped");
  assert.equal(err.decision.status, "blocked");
  assert.ok(err.message.includes("$10.50 of $10.00"));
  assert.ok(err.message.toLowerCase().includes("next calendar month"));
});

test("AiSpendCapError: name + code are stable", () => {
  // The action layer's catch sites filter on `.code === "ai_spend_capped"`
  // — pin so a future refactor doesn't silently drop the toast path.
  const decision = decideAiSpendStatus({
    usedMicros: 12_000_000,
    limitMicros: 10_000_000,
  });
  const err = new AiSpendCapError(decision);
  assert.equal(err.name, "AiSpendCapError");
  assert.ok(err instanceof Error);
});
