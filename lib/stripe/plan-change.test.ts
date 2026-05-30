import test from "node:test";
import assert from "node:assert/strict";

import { classifyPlanChange, PLAN_RANK } from "@/lib/stripe/plan-change";

test("plan ranks are strictly increasing free < starter < growth < enterprise", () => {
  assert.ok(PLAN_RANK.free < PLAN_RANK.starter);
  assert.ok(PLAN_RANK.starter < PLAN_RANK.growth);
  assert.ok(PLAN_RANK.growth < PLAN_RANK.enterprise);
});

test("tier upgrade is immediate", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "starter", currentInterval: "month" },
      { plan: "growth", interval: "month" },
    ),
    "immediate",
  );
});

test("tier downgrade is scheduled", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: "month" },
      { plan: "starter", interval: "month" },
    ),
    "scheduled",
  );
});

test("tier downgrade is scheduled regardless of interval", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "enterprise", currentInterval: "year" },
      { plan: "starter", interval: "month" },
    ),
    "scheduled",
  );
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: "month" },
      { plan: "starter", interval: "year" },
    ),
    "scheduled",
  );
});

test("same tier month -> year is immediate", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: "month" },
      { plan: "growth", interval: "year" },
    ),
    "immediate",
  );
});

test("same tier year -> month is scheduled", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: "year" },
      { plan: "growth", interval: "month" },
    ),
    "scheduled",
  );
});

test("same tier same interval is immediate (no-op)", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: "month" },
      { plan: "growth", interval: "month" },
    ),
    "immediate",
  );
});

test("unknown current interval keeps same-tier changes immediate", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "growth", currentInterval: null },
      { plan: "growth", interval: "month" },
    ),
    "immediate",
  );
});

test("upgrade from free is immediate", () => {
  assert.equal(
    classifyPlanChange(
      { currentPlan: "free", currentInterval: null },
      { plan: "starter", interval: "month" },
    ),
    "immediate",
  );
});
