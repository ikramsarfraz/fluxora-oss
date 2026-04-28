import assert from "node:assert/strict";
import test from "node:test";

import {
  formatUsageLimit,
  getUsagePercent,
  getUsageState,
} from "@/lib/subscription-usage-metrics";

test("usage percent returns null for unlimited limits", () => {
  assert.equal(
    getUsagePercent({ current: 5, limit: Number.POSITIVE_INFINITY }),
    null,
  );
  assert.equal(formatUsageLimit(Number.POSITIVE_INFINITY), "Unlimited");
});

test("usage state stays normal below the near-limit threshold", () => {
  assert.equal(getUsagePercent({ current: 79, limit: 100 }), 79);
  assert.equal(getUsageState({ current: 79, limit: 100 }), "normal");
});

test("usage state becomes warning at the 80 percent threshold", () => {
  assert.equal(getUsagePercent({ current: 8, limit: 10 }), 80);
  assert.equal(getUsageState({ current: 8, limit: 10 }), "warning");
});

test("usage state becomes at_limit when usage reaches the cap", () => {
  assert.equal(getUsagePercent({ current: 10, limit: 10 }), 100);
  assert.equal(getUsageState({ current: 10, limit: 10 }), "at_limit");
  assert.equal(getUsageState({ current: 12, limit: 10 }), "at_limit");
});
