import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COST_ANOMALY_THRESHOLD,
  classifyCostDelta,
} from "./cost-anomaly";

test("classifyCostDelta: returns 'new' when no recorded cost exists", () => {
  assert.deepEqual(classifyCostDelta(null, "2.5000"), { kind: "new" });
  assert.deepEqual(classifyCostDelta(undefined, "2.5000"), { kind: "new" });
});

test("classifyCostDelta: returns 'new' when recorded cost is zero or garbage", () => {
  // A recorded cost of $0 means the prior write never wrote a meaningful
  // value — anchoring an anomaly check against it would always trip 100%.
  assert.deepEqual(classifyCostDelta("0", "2.5000"), { kind: "new" });
  assert.deepEqual(classifyCostDelta("0.0000", "2.5000"), { kind: "new" });
  assert.deepEqual(classifyCostDelta("not-a-number", "2.5000"), { kind: "new" });
});

test("classifyCostDelta: returns 'unchanged' when string-equal", () => {
  assert.deepEqual(classifyCostDelta("2.5000", "2.5000"), { kind: "unchanged" });
});

test("classifyCostDelta: small move (<15%) classifies as 'changed'", () => {
  // 2.50 → 2.70 is +8%.
  const result = classifyCostDelta("2.5000", "2.7000");
  assert.equal(result?.kind, "changed");
  assert.ok(result && result.kind === "changed");
  if (result.kind === "changed") {
    assert.ok(Math.abs(result.deltaFraction - 0.08) < 1e-9);
  }
});

test("classifyCostDelta: a move at exactly 15% is NOT an anomaly", () => {
  // Threshold is strict — anomaly fires on >15%, so a clean 15.0% should
  // still register as a soft "changed" banner. Pick numbers that produce
  // exactly +15% with no float drift.
  const result = classifyCostDelta("1.0000", "1.1500");
  assert.equal(result?.kind, "changed");
});

test("classifyCostDelta: a move just past 15% triggers 'anomaly'", () => {
  const result = classifyCostDelta("1.0000", "1.1501");
  assert.equal(result?.kind, "anomaly");
  assert.ok(result && result.kind === "anomaly");
  if (result.kind === "anomaly") {
    assert.ok(result.deltaFraction > COST_ANOMALY_THRESHOLD);
  }
});

test("classifyCostDelta: large jump up classifies as 'anomaly'", () => {
  // $2.50 → $3.50 = +40%.
  const result = classifyCostDelta("2.5000", "3.5000");
  assert.equal(result?.kind, "anomaly");
});

test("classifyCostDelta: large drop classifies as 'anomaly'", () => {
  // $2.50 → $1.00 = -60%. Symmetric — anomaly fires on either direction.
  const result = classifyCostDelta("2.5000", "1.0000");
  assert.equal(result?.kind, "anomaly");
  if (result?.kind === "anomaly") {
    assert.ok(result.deltaFraction < -COST_ANOMALY_THRESHOLD);
  }
});

test("classifyCostDelta: returns null when live cost is missing/invalid", () => {
  assert.equal(classifyCostDelta("2.5000", null), null);
  assert.equal(classifyCostDelta("2.5000", undefined), null);
  assert.equal(classifyCostDelta("2.5000", "not-a-number"), null);
  assert.equal(classifyCostDelta("2.5000", "-1"), null);
});
