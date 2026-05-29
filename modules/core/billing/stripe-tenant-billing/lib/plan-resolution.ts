import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { stripePrices } from "@/db/schema";
import {
  parseBillingPlanFromStripeMetadata,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
import type { StripeBillingInterval } from "@/lib/stripe/checkout-plan-schema";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

/**
 * Map subscription line price id → tenant plan, using the synced Stripe catalog.
 * Order: row `billing_plan_key` → cached Price `metadata_json.plan`. The catalog
 * is the single source of truth; an uncached price id is an error (re-run
 * "Sync Stripe catalog").
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
  throw new Error(
    `Unmapped Stripe price id: ${priceId}. Re-run "Sync Stripe catalog" so the price is cached.`,
  );
}

/**
 * Checkout: pick Stripe Price id for a paid plan + billing interval from the
 * synced catalog — the newest active cached row matching both `billing_plan_key`
 * and `recurring_interval`. The catalog is the single source of truth; if no
 * matching price is synced, checkout throws a clear error (seed + sync first).
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
  const cadence = interval === "year" ? "annual" : "monthly";
  throw new Error(
    `No active ${cadence} Stripe price found for plan "${plan}". Seed prices (pnpm stripe:seed) and run "Sync Stripe catalog".`,
  );
}
