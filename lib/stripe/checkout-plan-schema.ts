import { z } from "zod";

import { STRIPE_SAAS_PAID_PLAN_KEYS } from "@/lib/stripe/plan-metadata";

/** Single source for server actions validating Checkout subscription plan slug. */
export const stripeSaasPaidPlanSchema = z.enum(STRIPE_SAAS_PAID_PLAN_KEYS);

export type StripeSaasPaidPlanInput = z.infer<typeof stripeSaasPaidPlanSchema>;
