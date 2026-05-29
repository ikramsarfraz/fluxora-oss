import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { stripePrices } from "@/db/schema";
import {
  parseBillingPlanFromStripeMetadata,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
import type { StripeBillingInterval } from "@/lib/stripe/checkout-plan-schema";
import {
  stripePriceIdForPaidPlanFromEnv,
  tryTenantPlanFromEnvPriceId,
} from "./price-to-plan-env";
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
 * Checkout: pick Stripe Price id for a paid plan + billing interval.
 * Order: newest active cached row with matching `billing_plan_key` and
 * `recurring_interval` → env `STRIPE_PRICE_*` (monthly only; the env vars hold
 * monthly price ids). Annual checkout requires a synced annual price — there is
 * no annual env fallback, so an unsynced annual catalog throws a clear error.
 */
export async function resolveStripePriceIdForPaidPlan(
  plan: StripeSaasPaidPlanKey,
  interval: StripeBillingInterval = "month",
): Promise<string> {
  const row = await db.query.stripePrices.findFirst({
    where: and(
      eq(stripePrices.billingPlanKey, plan),
      eq(stripePrices.active, true),
      eq(stripePrices.recurringInterval, interval),
    ),
    orderBy: [desc(stripePrices.stripeCreatedAt)],
  });
  const id = row?.stripePriceId?.trim();
  if (id) {
    return id;
  }
  if (interval === "year") {
    throw new Error(
      `No active annual Stripe price found for plan "${plan}". Seed annual prices (pnpm stripe:seed) and run "Sync Stripe catalog".`,
    );
  }
  return stripePriceIdForPaidPlanFromEnv(plan);
}
