import assert from "node:assert/strict";
import test from "node:test";

import {
  createFeatureUnavailableError,
  createPlanLimitReachedError,
  isFeatureRequiredMessage,
  isLimitReachedMessage,
  parseSubscriptionEnforcementMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";

test("plan limit errors carry a parseable enforcement prefix", () => {
  const error = createPlanLimitReachedError({
    tenant: {
      subscriptionPlan: "starter",
    },
    limitKey: "maxProducts",
    limit: 250,
    resourceLabel: "products",
  });

  const parsed = parseSubscriptionEnforcementMessage(error.message);

  assert.deepEqual(parsed?.reason, "limit_reached");
  assert.deepEqual(parsed?.key, "maxProducts");
  assert.equal(isLimitReachedMessage(error.message, "maxProducts"), true);
  assert.match(stripSubscriptionEnforcementPrefix(error.message), /250 products/);
});

test("feature errors carry a parseable enforcement prefix", () => {
  const error = createFeatureUnavailableError({
    featureKey: "reports",
    currentPlan: "starter",
    requiredPlan: "growth",
  });

  const parsed = parseSubscriptionEnforcementMessage(error.message);

  assert.deepEqual(parsed?.reason, "feature_required");
  assert.deepEqual(parsed?.key, "reports");
  assert.equal(isFeatureRequiredMessage(error.message, "reports"), true);
  assert.match(stripSubscriptionEnforcementPrefix(error.message), /Growth or higher/);
});
