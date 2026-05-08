import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { auditLogs, stripePrices, stripeProducts } from "@/db/schema";
import {
  parseBillingPlanFromStripeMetadata,
  STRIPE_SAAS_PAID_PLAN_KEYS,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
import { isPostgresUndefinedTableError } from "@/lib/pg/postgres-errors";
import { getStripeClient } from "@/lib/stripe/config";

const CATALOG_EVENT_TYPES: ReadonlyArray<string> = [
  "product.created",
  "product.updated",
  "product.deleted",
  "price.created",
  "price.updated",
  "price.deleted",
];

export function isStripeCatalogWebhookEvent(eventType: string): boolean {
  return CATALOG_EVENT_TYPES.includes(eventType);
}

/** Never returns an Invalid Date (avoids driver/serialize errors when binding timestamptz). */
function stripeUnixToDate(seconds: number | null | undefined): Date {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return new Date(0);
  }
  const d = new Date(seconds * 1000);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

const STRIPE_PRODUCT_NAME_MAX = 512;

function stripeProductNameForCatalog(product: Stripe.Product): string {
  const raw = typeof product.name === "string" ? product.name.trim() : "";
  if (raw.length > 0) {
    return raw.length <= STRIPE_PRODUCT_NAME_MAX
      ? raw
      : raw.slice(0, STRIPE_PRODUCT_NAME_MAX);
  }
  return product.id;
}

function stripeProductDescriptionForCatalog(product: Stripe.Product): string | null {
  if (product.description == null) {
    return null;
  }
  const s = String(product.description).trim();
  return s.length === 0 ? null : s;
}

function stripeMetadata(metadata: Stripe.Metadata): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    out[k] = typeof v === "string" ? v : String(v ?? "");
  }
  return out;
}

/**
 * Persisted billing plan key: Price `metadata.plan` first,
 * otherwise Product `metadata.plan` (`parseBillingPlanFromStripeMetadata`).
 */
function deriveBillingPlanKey(
  price: Stripe.Price,
  product: Stripe.Product,
): StripeSaasPaidPlanKey | null {
  const fromPrice = parseBillingPlanFromStripeMetadata(price.metadata ?? {});
  if (fromPrice) {
    return fromPrice;
  }
  return parseBillingPlanFromStripeMetadata(product.metadata ?? {});
}

/**
 * Lists all Prices for this Product in Stripe (default list includes inactive rows)
 * and upserts cached rows — updates `billing_plan_key` after Product-only metadata changes.
 */
export async function refreshCachedPricesForStripeProduct(
  stripeProductId: string,
): Promise<number> {
  const stripe = getStripeClient();
  let pricesRefreshed = 0;
  let startingAfter: string | undefined;

  for (;;) {
    const list = await stripe.prices.list({
      product: stripeProductId,
      limit: 100,
      starting_after: startingAfter,
    });
    if (list.data.length === 0) {
      break;
    }
    for (const pc of list.data) {
      await upsertStripePriceFromStripe(pc);
      pricesRefreshed += 1;
    }
    if (!list.has_more) {
      break;
    }
    const last = list.data[list.data.length - 1]?.id;
    if (!last) {
      break;
    }
    startingAfter = last;
  }
  return pricesRefreshed;
}

export async function upsertStripeProductFromStripe(product: Stripe.Product): Promise<void> {
  const stripeProductId = product.id?.trim();
  if (!stripeProductId) {
    throw new Error("Stripe product missing id.");
  }
  const metadataJson = stripeMetadata(product.metadata ?? {});
  const name = stripeProductNameForCatalog(product);
  const description = stripeProductDescriptionForCatalog(product);
  const stripeCreatedAt = stripeUnixToDate(product.created);
  const active = product.active !== false;

  await db
    .insert(stripeProducts)
    .values({
      stripeProductId,
      name,
      description,
      active,
      metadataJson,
      stripeCreatedAt,
    })
    .onConflictDoUpdate({
      target: stripeProducts.stripeProductId,
      set: {
        name,
        description,
        active,
        metadataJson,
        updatedAt: new Date(),
      },
    });
}

export async function upsertStripePriceFromStripe(price: Stripe.Price): Promise<void> {
  const stripe = getStripeClient();
  const productSid =
    typeof price.product === "string" ? price.product : price.product?.id;

  if (!productSid) {
    throw new Error("Stripe price missing product id.");
  }

  const productResolved = await stripe.products.retrieve(productSid);
  await upsertStripeProductFromStripe(productResolved);

  let priceFull = price;
  if (!price.currency || price.unit_amount == null || !price.created) {
    priceFull = await stripe.prices.retrieve(price.id);
  }

  const billingPlanKey = deriveBillingPlanKey(priceFull, productResolved);

  const recurring = priceFull.recurring;
  await db
    .insert(stripePrices)
    .values({
      stripePriceId: priceFull.id,
      stripeProductId: productSid,
      lookupKey: priceFull.lookup_key ?? null,
      billingPlanKey: billingPlanKey ?? null,
      currency: priceFull.currency.toLowerCase(),
      unitAmount: priceFull.unit_amount ?? null,
      recurringInterval: recurring?.interval ?? null,
      recurringIntervalCount:
        recurring?.interval_count != null ? recurring.interval_count : null,
      active: priceFull.active,
      metadataJson: stripeMetadata(priceFull.metadata ?? {}),
      stripeCreatedAt: stripeUnixToDate(priceFull.created),
    })
    .onConflictDoUpdate({
      target: stripePrices.stripePriceId,
      set: {
        stripeProductId: productSid,
        lookupKey: priceFull.lookup_key ?? null,
        billingPlanKey: billingPlanKey ?? null,
        currency: priceFull.currency.toLowerCase(),
        unitAmount: priceFull.unit_amount ?? null,
        recurringInterval: recurring?.interval ?? null,
        recurringIntervalCount:
          recurring?.interval_count != null ? recurring.interval_count : null,
        active: priceFull.active,
        metadataJson: stripeMetadata(priceFull.metadata ?? {}),
        updatedAt: new Date(),
      },
    });
}

export async function archiveStripePriceInCatalog(stripePriceId: string): Promise<void> {
  await db
    .update(stripePrices)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(stripePrices.stripePriceId, stripePriceId.trim()));
}

/** Archives product and all cached prices — keeps historical id → metadata for tenant sync. */
export async function archiveStripeProductInCatalog(stripeProductId: string): Promise<void> {
  const sid = stripeProductId.trim();
  await db
    .update(stripeProducts)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(stripeProducts.stripeProductId, sid));

  await db
    .update(stripePrices)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(stripePrices.stripeProductId, sid));
}

/** Avoid duplicate catalog audit rows when the same Stripe `event.id` is reprocessed after a stale row. */
async function stripeCatalogWebhookAuditAlreadyExists(
  stripeEventId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        sql`(context_json::json ->> 'action') = 'stripe_catalog_webhook'`,
        sql`(context_json::json ->> 'stripeEventId') = ${stripeEventId}`,
      ),
    )
    .limit(1);
  return row != null;
}

async function writeCatalogWebhookAudit(params: {
  action: "insert" | "update" | "delete";
  entityTable: "stripe_products" | "stripe_prices";
  entityId: string;
  entityLabel: string | null;
  stripeEventType: string;
  stripeEventId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (await stripeCatalogWebhookAuditAlreadyExists(params.stripeEventId)) {
    return;
  }
  await db.insert(auditLogs).values({
    tenantId: null,
    actorType: "system",
    action: params.action,
    entityTable: params.entityTable,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    contextJson: JSON.stringify({
      action: "stripe_catalog_webhook",
      syncChannel: "webhook",
      stripeEventType: params.stripeEventType,
      stripeEventId: params.stripeEventId,
      ...(params.detail ?? {}),
    }),
  });
}

export async function processStripeCatalogWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "product.created":
    case "product.updated": {
      const obj = event.data.object as Stripe.Product;
      await upsertStripeProductFromStripe(obj);
      let pricesRefreshed = 0;
      try {
        pricesRefreshed = await refreshCachedPricesForStripeProduct(obj.id);
      } catch {
        /** Product row remains valid; Stripe may omit price listings briefly on create. */
      }
      await writeCatalogWebhookAudit({
        action: event.type === "product.created" ? "insert" : "update",
        entityTable: "stripe_products",
        entityId: obj.id,
        entityLabel: obj.name ?? obj.id,
        stripeEventType: event.type,
        stripeEventId: event.id,
        detail: { catalogPricesRefreshed: pricesRefreshed },
      });
      return;
    }
    case "product.deleted": {
      const obj = event.data.object as { id: string };
      await archiveStripeProductInCatalog(obj.id);
      await writeCatalogWebhookAudit({
        action: "update",
        entityTable: "stripe_products",
        entityId: obj.id,
        entityLabel: obj.id,
        stripeEventType: event.type,
        stripeEventId: event.id,
        detail: {
          stripeCatalogLifecycle: "product_deleted_catalog_archived",
        },
      });
      return;
    }
    case "price.created":
    case "price.updated": {
      const obj = event.data.object as Stripe.Price;
      await upsertStripePriceFromStripe(obj);
      await writeCatalogWebhookAudit({
        action: event.type === "price.created" ? "insert" : "update",
        entityTable: "stripe_prices",
        entityId: obj.id,
        entityLabel:
          typeof obj.lookup_key === "string" && obj.lookup_key
            ? obj.lookup_key
            : obj.id,
        stripeEventType: event.type,
        stripeEventId: event.id,
      });
      return;
    }
    case "price.deleted": {
      const obj = event.data.object as { id: string };
      await archiveStripePriceInCatalog(obj.id);
      await writeCatalogWebhookAudit({
        action: "update",
        entityTable: "stripe_prices",
        entityId: obj.id,
        entityLabel: obj.id,
        stripeEventType: event.type,
        stripeEventId: event.id,
        detail: {
          stripeCatalogLifecycle: "price_deleted_catalog_archived",
        },
      });
      return;
    }
    default:
      return;
  }
}

export async function syncStripeCatalogFullFromStripeApi(input: {
  actorType: "system" | "platform_user";
  platformUserId?: string | null;
}): Promise<{ productsUpserted: number; pricesUpserted: number }> {
  if (input.actorType === "platform_user" && !input.platformUserId) {
    throw new Error("syncStripeCatalogFullFromStripeApi: platformUserId is required for platform_user.");
  }
  const stripe = getStripeClient();
  let productsUpserted = 0;
  let pricesUpserted = 0;

  let prodAfter: string | undefined;

  for (;;) {
    const list = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: prodAfter,
    });
    for (const p of list.data) {
      await upsertStripeProductFromStripe(p);
      productsUpserted += 1;
    }
    if (!list.has_more) {
      break;
    }
    const lastId = list.data[list.data.length - 1]?.id;
    if (!lastId) {
      break;
    }
    prodAfter = lastId;
  }

  let priceAfter: string | undefined;
  for (;;) {
    const plist = await stripe.prices.list({
      active: true,
      limit: 100,
      starting_after: priceAfter,
    });
    for (const pc of plist.data) {
      await upsertStripePriceFromStripe(pc);
      pricesUpserted += 1;
    }
    if (!plist.has_more) {
      break;
    }
    const last = plist.data[plist.data.length - 1]?.id;
    if (!last) {
      break;
    }
    priceAfter = last;
  }

  await db.insert(auditLogs).values({
    tenantId: null,
    actorType: input.actorType === "platform_user" ? "platform_user" : "system",
    actorPlatformUserId: input.actorType === "platform_user" ? input.platformUserId ?? null : null,
    action: "update",
    entityTable: "stripe_catalog",
    entityId: "sync_full",
    entityLabel: "Stripe catalog sync (API)",
    contextJson: JSON.stringify({
      action: "stripe_catalog_sync",
      syncChannel: "full_api",
      source: "stripe_api",
      actorType: input.actorType,
      productsUpserted,
      pricesUpserted,
    }),
  });

  return { productsUpserted, pricesUpserted };
}

/** One selectable paid tier for tenant billing UI (newest active Stripe price per plan key). */
export type BillingCatalogPlanRow = {
  planKey: StripeSaasPaidPlanKey;
  stripePriceId: string;
  productName: string;
  productDescription: string | null;
  currency: string;
  unitAmountCents: number | null;
  recurringInterval: string | null;
  recurringIntervalCount: number | null;
};

/** Active paid prices/products only (`active` on both tables). Subscription tiers with `billing_plan_key`; deduped newest per plan. */
export async function listActivePaidPlansForBillingPage(): Promise<
  BillingCatalogPlanRow[]
> {
  try {
    const paid = [...STRIPE_SAAS_PAID_PLAN_KEYS];
    const rows = await db
      .select({
        billingPlanKey: stripePrices.billingPlanKey,
        stripePriceId: stripePrices.stripePriceId,
        productName: stripeProducts.name,
        productDescription: stripeProducts.description,
        currency: stripePrices.currency,
        unitAmount: stripePrices.unitAmount,
        recurringInterval: stripePrices.recurringInterval,
        recurringIntervalCount: stripePrices.recurringIntervalCount,
      })
      .from(stripePrices)
      .innerJoin(
        stripeProducts,
        eq(stripePrices.stripeProductId, stripeProducts.stripeProductId),
      )
      .where(
        and(
          eq(stripePrices.active, true),
          eq(stripeProducts.active, true),
          isNotNull(stripePrices.billingPlanKey),
          isNotNull(stripePrices.recurringInterval),
          inArray(stripePrices.billingPlanKey, paid),
        ),
      )
      .orderBy(desc(stripePrices.stripeCreatedAt));

    const byPlan = new Map<StripeSaasPaidPlanKey, BillingCatalogPlanRow>();

    for (const row of rows) {
      const k = row.billingPlanKey;
      if (
        k !== "starter" &&
        k !== "growth" &&
        k !== "enterprise"
      ) {
        continue;
      }
      if (byPlan.has(k)) {
        continue;
      }
      byPlan.set(k, {
        planKey: k,
        stripePriceId: row.stripePriceId,
        productName: row.productName,
        productDescription: row.productDescription,
        currency: row.currency,
        unitAmountCents: row.unitAmount,
        recurringInterval: row.recurringInterval,
        recurringIntervalCount: row.recurringIntervalCount,
      });
    }

    const ordered: BillingCatalogPlanRow[] = [];
    for (const pk of STRIPE_SAAS_PAID_PLAN_KEYS) {
      const r = byPlan.get(pk);
      if (r) {
        ordered.push(r);
      }
    }
    return ordered;
  } catch (err) {
    if (isPostgresUndefinedTableError(err)) {
      console.warn(
        "[stripe-catalog] Cached Stripe catalog tables are missing (42P01). Run `npm run db:migrate` against the DATABASE_URL used by Next.js so stripe_products/stripe_prices exist.",
      );
    } else {
      console.warn(
        "[stripe-catalog] listActivePaidPlansForBillingPage failed (billing page will show an empty catalog):",
        err,
      );
    }
    return [];
  }
}
