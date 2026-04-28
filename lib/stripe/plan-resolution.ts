import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { stripePrices } from "@/db/schema";
import {
  parseBillingPlanFromStripeMetadata,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
import {
  stripePriceIdForPaidPlanFromEnv,
  tryTenantPlanFromEnvPriceId,
} from "@/lib/stripe/price-to-plan-env";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

/**
 * Map subscription line price id → tenant plan.
 * Order: row `billing_plan_key` → cached Price `metadata_json.plan` → `STRIPE_PRICE_*` env match.
 */
export async function resolveTenantPlanFromStripePriceId(
  priceId: string,
): Promise<TenantSubscriptionPlan> {
  const row = await db.query.stripePrices.findFirst({
    where: eq(stripePrices.stripePriceId, priceId.trim()),
  });
  if (row?.billingPlanKey) {
    return row.billingPlanKey as StripeSaasPaidPlanKey as TenantSubscriptionPlan;
  }
  if (row) {
    const fromMeta = parseBillingPlanFromStripeMetadata(row.metadataJson);
    if (fromMeta) {
      return fromMeta;
    }
  }
  const envPlan = tryTenantPlanFromEnvPriceId(priceId);
  if (envPlan !== null) {
    return envPlan;
  }
  throw new Error(`Unmapped Stripe price id: ${priceId}`);
}

/**
 * Checkout: pick Stripe Price id for a paid plan.
 * Order: newest active cached row with `billing_plan_key` → env `STRIPE_PRICE_*`.
 */
export async function resolveStripePriceIdForPaidPlan(
  plan: StripeSaasPaidPlanKey,
): Promise<string> {
  const row = await db.query.stripePrices.findFirst({
    where: and(
      eq(stripePrices.billingPlanKey, plan),
      eq(stripePrices.active, true),
    ),
    orderBy: [desc(stripePrices.stripeCreatedAt)],
  });
  const id = row?.stripePriceId?.trim();
  if (id) {
    return id;
  }
  return stripePriceIdForPaidPlanFromEnv(plan);
}
