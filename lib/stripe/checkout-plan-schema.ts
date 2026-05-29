import { z } from "zod";

import { STRIPE_SAAS_PAID_PLAN_KEYS } from "@/lib/stripe/plan-metadata";

/** Single source for server actions validating Checkout subscription plan slug. */
export const stripeSaasPaidPlanSchema = z.enum(STRIPE_SAAS_PAID_PLAN_KEYS);

export type StripeSaasPaidPlanInput = z.infer<typeof stripeSaasPaidPlanSchema>;

/** Recurring billing cadence offered for each paid tier. */
export const STRIPE_BILLING_INTERVALS = ["month", "year"] as const;

export type StripeBillingInterval = (typeof STRIPE_BILLING_INTERVALS)[number];

/** Validates the billing interval slug; defaults to monthly when omitted. */
export const stripeBillingIntervalSchema = z
  .enum(STRIPE_BILLING_INTERVALS)
  .default("month");
