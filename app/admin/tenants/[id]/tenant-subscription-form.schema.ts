import { z } from "zod";

import {
  TENANT_SUBSCRIPTION_PLAN_VALUES,
  TENANT_SUBSCRIPTION_STATUS_VALUES,
} from "@/lib/tenant-subscription";

export const tenantSubscriptionFormSchema = z.object({
  subscriptionPlan: z.enum(TENANT_SUBSCRIPTION_PLAN_VALUES),
  subscriptionStatus: z.enum(TENANT_SUBSCRIPTION_STATUS_VALUES),
  /** ISO or datetime-local from the browser; empty clears */
  trialEndsAt: z.string().optional().nullable(),
  currentPeriodEndsAt: z.string().optional().nullable(),
  stripeCustomerId: z.string().max(255).optional().nullable(),
  stripeSubscriptionId: z.string().max(255).optional().nullable(),
});

export type TenantSubscriptionFormInput = z.infer<typeof tenantSubscriptionFormSchema>;

function parseOptionalDateString(value: string | null | undefined): Date | null {
  if (value == null || !String(value).trim()) {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date value.");
  }
  return d;
}

function normalizeOptionalStripeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t ? t : null;
}

export function parseTenantSubscriptionFormForService(
  input: TenantSubscriptionFormInput,
) {
  return {
    subscriptionPlan: input.subscriptionPlan,
    subscriptionStatus: input.subscriptionStatus,
    trialEndsAt: parseOptionalDateString(
      input.trialEndsAt ?? null,
    ),
    currentPeriodEndsAt: parseOptionalDateString(
      input.currentPeriodEndsAt ?? null,
    ),
    stripeCustomerId: normalizeOptionalStripeId(
      input.stripeCustomerId ?? null,
    ),
    stripeSubscriptionId: normalizeOptionalStripeId(
      input.stripeSubscriptionId ?? null,
    ),
  };
}
