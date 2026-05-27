import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import { createFeatureUnavailableError } from "@/lib/subscription-enforcement";

export const SUBSCRIPTION_FEATURE_KEYS = [
  "sales_orders",
  "purchasing",
  "inventory",
  "dashboard",
  "support_tickets",
  "reports",
  "platform_support",
] as const;

export type SubscriptionFeatureKey = (typeof SUBSCRIPTION_FEATURE_KEYS)[number];

export const SUBSCRIPTION_LIMIT_KEYS = [
  "maxPortalUsers",
  "maxProducts",
  "maxCustomers",
  "maxMonthlyOrders",
  /**
   * Per-tenant calendar-month ceiling on AI spend (#235). Stored in
   * micro-USD (1 = $0.000001) to match `ai_usage_events.cost_micros` and
   * avoid float-rounding across aggregates. The enforcement helper
   * surfaces a soft warning at 80% and hard-blocks new AI-driven parse
   * actions at 100% until the next calendar month rolls. `UNLIMITED`
   * disables enforcement entirely (used for the enterprise plan + comped
   * tenants).
   */
  "maxMonthlyAiCostMicros",
] as const;

export type SubscriptionLimitKey = (typeof SUBSCRIPTION_LIMIT_KEYS)[number];

export type SubscriptionFeatureMap = Record<SubscriptionFeatureKey, boolean>;
export type SubscriptionLimitMap = Record<SubscriptionLimitKey, number>;

export type TenantPlanCapabilities = {
  plan: TenantSubscriptionPlan;
  status?: TenantSubscriptionStatus | null | undefined;
  effectivePlan: TenantSubscriptionPlan;
  features: SubscriptionFeatureMap;
  limits: SubscriptionLimitMap;
};

export type TenantPlanCapabilitySubject = {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus?: TenantSubscriptionStatus | null | undefined;
};

type PlanCapabilityMatrix = {
  features: SubscriptionFeatureMap;
  limits: SubscriptionLimitMap;
};

const UNLIMITED = Number.POSITIVE_INFINITY;

export const SUBSCRIPTION_PLAN_CAPABILITY_MATRIX = {
  free: {
    features: {
      sales_orders: false,
      purchasing: false,
      inventory: false,
      dashboard: true,
      support_tickets: true,
      reports: false,
      platform_support: false,
    },
    limits: {
      maxPortalUsers: 1,
      maxProducts: 25,
      maxCustomers: 25,
      maxMonthlyOrders: 25,
      // ~$1 ceiling. Most free tenants are exploring the product, not
      // bulk-importing 50 PDFs a day — enough headroom for a handful of
      // single-receipt scans without bankrolling someone's whole AP run.
      maxMonthlyAiCostMicros: 1_000_000,
    },
  },
  starter: {
    features: {
      sales_orders: true,
      purchasing: false,
      inventory: true,
      dashboard: true,
      support_tickets: true,
      reports: false,
      platform_support: false,
    },
    limits: {
      maxPortalUsers: 3,
      maxProducts: 250,
      maxCustomers: 250,
      maxMonthlyOrders: 100,
      // ~$10 ceiling. Starter tenants typically run a few dozen bills per
      // month — at the current gpt-4o-mini cost (~$0.01-0.02 per bill),
      // that's well inside the cap with a margin for the occasional
      // vision-fallback escalation.
      maxMonthlyAiCostMicros: 10_000_000,
    },
  },
  growth: {
    features: {
      sales_orders: true,
      purchasing: true,
      inventory: true,
      dashboard: true,
      support_tickets: true,
      reports: true,
      platform_support: false,
    },
    limits: {
      maxPortalUsers: 10,
      maxProducts: 5_000,
      maxCustomers: 5_000,
      maxMonthlyOrders: 1_000,
      // ~$50 ceiling. Headroom for the 5-10× volume increase the
      // growth tier expects vs starter, and absorbs heavier vision
      // usage on harder PDFs.
      maxMonthlyAiCostMicros: 50_000_000,
    },
  },
  enterprise: {
    features: {
      sales_orders: true,
      purchasing: true,
      inventory: true,
      dashboard: true,
      support_tickets: true,
      reports: true,
      platform_support: true,
    },
    limits: {
      maxPortalUsers: UNLIMITED,
      maxProducts: UNLIMITED,
      maxCustomers: UNLIMITED,
      maxMonthlyOrders: UNLIMITED,
      maxMonthlyAiCostMicros: UNLIMITED,
    },
  },
} as const satisfies Record<TenantSubscriptionPlan, PlanCapabilityMatrix>;

export function getEffectiveTenantPlan(
  plan: TenantSubscriptionPlan,
  status?: TenantSubscriptionStatus | null,
): TenantSubscriptionPlan {
  if (status === "comped") {
    return "enterprise";
  }
  return plan;
}

export function getTenantPlanCapabilities(
  plan: TenantSubscriptionPlan,
  status?: TenantSubscriptionStatus | null,
): TenantPlanCapabilities {
  const effectivePlan = getEffectiveTenantPlan(plan, status);
  const capabilitySet = SUBSCRIPTION_PLAN_CAPABILITY_MATRIX[effectivePlan];

  return {
    plan,
    status,
    effectivePlan,
    features: capabilitySet.features,
    limits: capabilitySet.limits,
  };
}

export function canUseFeature(
  tenant: TenantPlanCapabilitySubject,
  featureKey: SubscriptionFeatureKey,
): boolean {
  return getTenantPlanCapabilities(
    tenant.subscriptionPlan,
    tenant.subscriptionStatus,
  ).features[featureKey];
}

export function getPlanLimit(
  tenant: TenantPlanCapabilitySubject,
  limitKey: SubscriptionLimitKey,
): number {
  return getTenantPlanCapabilities(
    tenant.subscriptionPlan,
    tenant.subscriptionStatus,
  ).limits[limitKey];
}

export function assertTenantCanUseFeature(
  tenant: TenantPlanCapabilitySubject,
  featureKey: SubscriptionFeatureKey,
): void {
  if (canUseFeature(tenant, featureKey)) {
    return;
  }

  throw createFeatureUnavailableError({
    featureKey,
    currentPlan: tenant.subscriptionPlan,
  });
}
