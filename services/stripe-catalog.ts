import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { auditLogs, stripePrices, stripeProducts } from "@/db/schema";
import {
  parseBillingPlanFromStripeMetadata,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
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

function stripeUnixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
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
  await db
    .insert(stripeProducts)
    .values({
      stripeProductId: product.id,
      name: product.name,
      description: product.description ?? null,
      active: product.active,
      metadataJson: stripeMetadata(product.metadata ?? {}),
      stripeCreatedAt: stripeUnixToDate(product.created),
    })
    .onConflictDoUpdate({
      target: stripeProducts.stripeProductId,
      set: {
        name: product.name,
        description: product.description ?? null,
        active: product.active,
        metadataJson: stripeMetadata(product.metadata ?? {}),
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

async function writeCatalogWebhookAudit(params: {
  action: "insert" | "update" | "delete";
  entityTable: "stripe_products" | "stripe_prices";
  entityId: string;
  entityLabel: string | null;
  stripeEventType: string;
  stripeEventId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
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
