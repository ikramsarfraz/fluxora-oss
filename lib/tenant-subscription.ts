import {
  tenantSubscriptionPlanEnum,
  tenantSubscriptionStatusEnum,
} from "@/db/schema";

export const TENANT_SUBSCRIPTION_PLAN_VALUES = tenantSubscriptionPlanEnum.enumValues;
export const TENANT_SUBSCRIPTION_STATUS_VALUES = tenantSubscriptionStatusEnum.enumValues;

export type TenantSubscriptionPlan = (typeof TENANT_SUBSCRIPTION_PLAN_VALUES)[number];
export type TenantSubscriptionStatus = (typeof TENANT_SUBSCRIPTION_STATUS_VALUES)[number];
