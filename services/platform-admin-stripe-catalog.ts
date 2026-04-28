import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, stripePrices, stripeProducts } from "@/db/schema";
import { STRIPE_SAAS_PAID_PLAN_KEYS } from "@/lib/stripe/plan-metadata";
import { isPostgresUndefinedTableError } from "@/lib/pg/postgres-errors";
import { requirePlatformUser } from "@/services/platform-users";

/** Grouped Stripe catalog rows for internal admin read-only view. */
export type PlatformAdminGroupedStripeCatalog = {
  product: typeof stripeProducts.$inferSelect;
  prices: Array<typeof stripePrices.$inferSelect>;
};

/** Full Stripe API sync audit row (`entity_table` = stripe_catalog, `entity_id` = sync_full). */
export type PlatformAdminStripeCatalogSyncAuditInfo = {
  createdAt: Date;
  actorType: "system" | "platform_user";
  actorPlatformUserId: string | null;
  productsUpserted: number | null;
  pricesUpserted: number | null;
};

const PAID_KEYS = new Set<string>(STRIPE_SAAS_PAID_PLAN_KEYS);

/** True when Stripe `active`, parent product `active`, `recurring_interval` set, and `billing_plan_key` ∈ starter|growth|enterprise. */
export function stripePriceEligibleForSaasBilling(
  price: typeof stripePrices.$inferSelect,
  productActive: boolean,
): boolean {
  if (!price.active || !productActive || !price.recurringInterval?.trim()) {
    return false;
  }
  const k = price.billingPlanKey;
  return !!(k && PAID_KEYS.has(k));
}

async function groupedCatalogRows(): Promise<PlatformAdminGroupedStripeCatalog[]> {
  try {
    const productRows = await db
      .select()
      .from(stripeProducts)
      .orderBy(asc(stripeProducts.name));

    const priceRows = await db
      .select()
      .from(stripePrices)
      .orderBy(desc(stripePrices.stripeCreatedAt));

    const pricesByPid = new Map<string, Array<typeof stripePrices.$inferSelect>>();
    for (const p of priceRows) {
      const list = pricesByPid.get(p.stripeProductId);
      if (list) {
        list.push(p);
      } else {
        pricesByPid.set(p.stripeProductId, [p]);
      }
    }

    return productRows.map(p => ({
      product: p,
      prices: pricesByPid.get(p.stripeProductId) ?? [],
    }));
  } catch (err) {
    if (isPostgresUndefinedTableError(err)) {
      console.warn(
        "[stripe-catalog] Cached Stripe catalog tables missing (42P01). Run `npm run db:migrate` on this DATABASE_URL.",
      );
    } else {
      console.warn("[platform-admin-stripe-catalog] groupedCatalogRows failed:", err);
    }
    return [];
  }
}

async function latestFullSyncAuditRow(): Promise<PlatformAdminStripeCatalogSyncAuditInfo | null> {
  const [row] = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        isNull(auditLogs.tenantId),
        eq(auditLogs.entityTable, "stripe_catalog"),
        eq(auditLogs.entityId, "sync_full"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!row?.contextJson) {
    return null;
  }

  let productsUpserted: number | null = null;
  let pricesUpserted: number | null = null;
  try {
    const ctx = JSON.parse(row.contextJson) as Record<string, unknown>;
    // Webhook catalog updates use `stripe_products` / `stripe_prices`; only full-API bulk sync uses this row shape.
    const isFullCatalogSyncAudit = ctx.action === "stripe_catalog_sync";
    const channel = ctx.syncChannel;
    const trustCounts =
      isFullCatalogSyncAudit &&
      (channel === "full_api" || channel === undefined);
    if (trustCounts) {
      if (typeof ctx.productsUpserted === "number") {
        productsUpserted = ctx.productsUpserted;
      }
      if (typeof ctx.pricesUpserted === "number") {
        pricesUpserted = ctx.pricesUpserted;
      }
    }
  } catch {
    void 0;
  }

  return {
    createdAt: row.createdAt,
    actorType:
      row.actorType === "platform_user" ? "platform_user" : ("system" as const),
    actorPlatformUserId: row.actorPlatformUserId ?? null,
    productsUpserted,
    pricesUpserted,
  };
}

/**
 * Loads data for `/admin/stripe-catalog`.
 * Calls {@link requirePlatformUser} once; the admin route layout also restricts access before render.
 */
export async function getPlatformAdminStripeCatalogPagePayload(): Promise<{
  grouped: PlatformAdminGroupedStripeCatalog[];
  lastFullSyncAudit: PlatformAdminStripeCatalogSyncAuditInfo | null;
}> {
  await requirePlatformUser();
  const [grouped, lastFullSyncAudit] = await Promise.all([
    groupedCatalogRows(),
    latestFullSyncAuditRow(),
  ]);
  return { grouped, lastFullSyncAudit };
}
