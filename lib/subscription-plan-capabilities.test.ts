import test from "node:test";
import assert from "node:assert/strict";

import {
  canUseFeature,
  getPlanLimit,
  getTenantPlanCapabilities,
} from "@/lib/subscription-plan-capabilities";

test("free plan exposes only the starter capability baseline subset", () => {
  const capabilities = getTenantPlanCapabilities("free");

  assert.equal(capabilities.effectivePlan, "free");
  assert.equal(capabilities.features.dashboard, true);
  assert.equal(capabilities.features.support_tickets, true);
  assert.equal(capabilities.features.sales_orders, false);
  assert.equal(capabilities.features.inventory, false);
  assert.equal(capabilities.features.reports, false);
  assert.equal(capabilities.limits.maxPortalUsers, 1);
  assert.equal(capabilities.limits.maxMonthlyOrders, 25);
});

test("growth unlocks purchasing and reports", () => {
  const tenant = {
    subscriptionPlan: "growth" as const,
    subscriptionStatus: "active" as const,
  };

  assert.equal(canUseFeature(tenant, "purchasing"), true);
  assert.equal(canUseFeature(tenant, "reports"), true);
  assert.equal(canUseFeature(tenant, "platform_support"), false);
  assert.equal(getPlanLimit(tenant, "maxProducts"), 5_000);
});

test("enterprise carries unlimited limits and platform support", () => {
  const tenant = {
    subscriptionPlan: "enterprise" as const,
    subscriptionStatus: "active" as const,
  };

  assert.equal(canUseFeature(tenant, "platform_support"), true);
  assert.equal(getPlanLimit(tenant, "maxPortalUsers"), Number.POSITIVE_INFINITY);
  assert.equal(getPlanLimit(tenant, "maxMonthlyOrders"), Number.POSITIVE_INFINITY);
});

test("comped status overrides a lower stored plan to enterprise capabilities", () => {
  const tenant = {
    subscriptionPlan: "starter" as const,
    subscriptionStatus: "comped" as const,
  };

  const capabilities = getTenantPlanCapabilities(
    tenant.subscriptionPlan,
    tenant.subscriptionStatus,
  );

  assert.equal(capabilities.plan, "starter");
  assert.equal(capabilities.effectivePlan, "enterprise");
  assert.equal(canUseFeature(tenant, "platform_support"), true);
  assert.equal(getPlanLimit(tenant, "maxCustomers"), Number.POSITIVE_INFINITY);
});
