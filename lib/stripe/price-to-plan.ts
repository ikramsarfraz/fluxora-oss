import { STRIPE_SAAS_PAID_PLAN_KEYS } from "./plan-metadata";

export { STRIPE_SAAS_PAID_PLAN_KEYS, type StripeSaasPaidPlanKey } from "./plan-metadata";

/** Backwards-compatible alias for marketing / checkout plan lists. */
export const STRIPE_CHECKOUT_PLANS = STRIPE_SAAS_PAID_PLAN_KEYS;

export {
  resolveStripePriceIdForPaidPlan,
  resolveTenantPlanFromStripePriceId,
} from "./plan-resolution";

export {
  stripePriceIdForPaidPlanFromEnv,
  tenantPlanFromEnvPriceId,
} from "./price-to-plan-env";
