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
