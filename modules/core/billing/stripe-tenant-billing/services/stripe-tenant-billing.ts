import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { auditLogs, tenants } from "@/db/schema";
import { getPreferredBillingEmailForTenant } from "@/modules/core/billing/services/billing-contacts";
import { getAppPublicOrigin, getStripeClient } from "@/lib/stripe/config";
import { tenantIdFromCheckoutSession } from "@/modules/core/billing/stripe-tenant-billing/lib/checkout-tenant-resolution";
import type { StripeSaasPaidPlanKey } from "@/lib/stripe/plan-metadata";
import {
  resolveStripePriceIdForPaidPlan,
  resolveTenantPlanFromStripePriceId,
} from "@/modules/core/billing/stripe-tenant-billing/lib/plan-resolution";
import {
  isStripeCatalogWebhookEvent,
  processStripeCatalogWebhook,
} from "@/modules/core/billing/stripe-catalog";
import { mapStripeSubscriptionStatus } from "@/modules/core/billing/stripe-tenant-billing/lib/subscription-status";
import {
  diffSubscriptionKeys,
  subscriptionSnapshotFromRow,
} from "@/modules/core/billing/stripe-tenant-billing/lib/tenant-subscription-audit";
import { STRIPE_METADATA_TENANT_ID } from "@/modules/core/billing/stripe-tenant-billing/lib/stripe-metadata-keys";
import type { TenantDefaultPaymentMethod } from "@/lib/stripe/tenant-default-payment-method";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import { isUuid } from "@/lib/utils/uuid";

export type StripeCheckoutPlan = StripeSaasPaidPlanKey;

function logStripeBillingEvent(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>,
): void {
  console[level](`[stripe billing] ${message}`, context);
}

/** Merge subscription payload with DB row: fill missing cust id; on mismatch prefer Stripe-subscription linkage. */
function reconcileStripeCustomerIdFromWebhook(
  storedTenant: string | null | undefined,
  fromSubscriptionCustomer: string | null,
): string | null {
  const incoming = fromSubscriptionCustomer?.trim() || null;
  const saved = storedTenant?.trim() || null;
  if (!incoming) {
    return saved;
  }
  if (!saved) {
    return incoming;
  }
  return incoming;
}

/**
 * Ensures exactly one Stripe Customer per tenant: reuse `tenants.stripe_customer_id`, or create +
 * persist (`metadata.tenantId`). Idempotent per tenant id.
 */
export async function getOrCreateStripeCustomerForTenant(tenantId: string): Promise<string> {
  const stripe = getStripeClient();

  const row = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!row) {
    throw new Error("Tenant not found.");
  }

  let existing: string | null = row.stripeCustomerId?.trim() || null;
  if (existing) {
    try {
      const fetched = await stripe.customers.retrieve(existing);
      if (typeof fetched === "object" && "deleted" in fetched && fetched.deleted) {
        existing = null;
        await db
          .update(tenants)
          .set({ stripeCustomerId: null, updatedAt: new Date() })
          .where(eq(tenants.id, tenantId));
      } else {
        return existing;
      }
    } catch {
      await db
        .update(tenants)
        .set({ stripeCustomerId: null, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    }
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!tenant) {
    throw new Error("Tenant not found.");
  }
  existing = tenant.stripeCustomerId?.trim() ?? null;
  if (existing) {
    return existing;
  }

  const email = await getPreferredBillingEmailForTenant(tenantId);
  if (!email?.trim()) {
    throw new Error("No billing email could be determined for Stripe customer creation.");
  }

  const customer = await stripe.customers.create(
    {
      email: email.trim(),
      name: tenant.name,
      metadata: { [STRIPE_METADATA_TENANT_ID]: tenantId },
    },
    { idempotencyKey: `tenant_create_customer:${tenantId}` },
  );

  await db
    .update(tenants)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return customer.id;
}

export type { TenantDefaultPaymentMethod } from "@/lib/stripe/tenant-default-payment-method";

function cardSummaryFromStripePaymentMethod(
  pm: Stripe.PaymentMethod,
): TenantDefaultPaymentMethod | null {
  if (pm.type !== "card" || !pm.card) {
    return null;
  }
  const { brand, last4, exp_month, exp_year } = pm.card;
  if (!last4 || exp_month == null || exp_year == null) {
    return null;
  }
  return {
    brand: brand ?? "card",
    last4,
    expMonth: exp_month,
    expYear: exp_year,
  };
}

/**
 * Resolves the tenant's default card for display via `invoice_settings.default_payment_method`,
 * falling back to the newest saved card (`type: card`, `limit: 1`). Never throws — returns null
 * when there is no customer, no usable card, or Stripe errors.
 *
 * Intended for Route Handlers, Server Components, and server actions only (uses secrets + Stripe API).
 */
export async function getTenantDefaultPaymentMethod(
  tenantId: string,
): Promise<TenantDefaultPaymentMethod | null> {
  try {
    const row = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    const stripeCustomerId = row?.stripeCustomerId?.trim();
    if (!stripeCustomerId) {
      return null;
    }

    const stripe = getStripeClient();

    const resolveFromPmId = async (pmId: string): Promise<TenantDefaultPaymentMethod | null> => {
      try {
        const pm = await stripe.paymentMethods.retrieve(pmId);
        return cardSummaryFromStripePaymentMethod(pm);
      } catch {
        return null;
      }
    };

    const tryCustomerDefault = async (): Promise<TenantDefaultPaymentMethod | null> => {
      let customer: Stripe.Customer | Stripe.DeletedCustomer;
      try {
        customer = (await stripe.customers.retrieve(stripeCustomerId, {
          expand: ["invoice_settings.default_payment_method"],
        })) as Stripe.Customer | Stripe.DeletedCustomer;
      } catch {
        return null;
      }
      if (typeof customer === "object" && "deleted" in customer && customer.deleted) {
        return null;
      }
      const def = customer.invoice_settings?.default_payment_method;
      if (!def) {
        return null;
      }
      if (typeof def === "string") {
        return resolveFromPmId(def);
      }
      if (typeof def === "object" && def.object === "payment_method") {
        return cardSummaryFromStripePaymentMethod(def);
      }
      return null;
    };

    const fromDefault = await tryCustomerDefault();
    if (fromDefault) {
      return fromDefault;
    }

    try {
      const listed = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
        limit: 1,
      });
      const first = listed.data[0];
      return first ? cardSummaryFromStripePaymentMethod(first) : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function createTenantStripeCheckoutSession(input: {
  tenantId: string;
  plan: StripeCheckoutPlan;
  /**
   * Path-relative success and cancel URLs appended for tenant UX:
   * — success: `?success=1&session_id={CHECKOUT_SESSION_ID}` (or `&` if the path already has a query string)
   * — cancel: `?canceled=1` / `&canceled=1`
   */
  successPath: string;
  /** Path for cancel, e.g. same as billing page */
  cancelPath: string;
}): Promise<{ url: string }> {
  const customerId = await getOrCreateStripeCustomerForTenant(input.tenantId);
  const priceId = await resolveStripePriceIdForPaidPlan(input.plan);
  const origin = getAppPublicOrigin();
  const successPath = input.successPath.startsWith("/")
    ? input.successPath
    : `/${input.successPath}`;
  const cancelPath = input.cancelPath.startsWith("/")
    ? input.cancelPath
    : `/${input.cancelPath}`;
  // Stripe replaces {CHECKOUT_SESSION_ID}; keep success=1 for tenant UX banners.
  const qp = successPath.includes("?") ? "&" : "?";
  const successUrl = `${origin}${successPath}${qp}success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelSuffix = cancelPath.includes("?") ? "&canceled=1" : "?canceled=1";
  const cancelUrl = `${origin}${cancelPath}${cancelSuffix}`;

  const stripe = getStripeClient();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: customerId,
    client_reference_id: input.tenantId,
    metadata: { [STRIPE_METADATA_TENANT_ID]: input.tenantId },
    subscription_data: {
      metadata: { [STRIPE_METADATA_TENANT_ID]: input.tenantId },
    },
  };

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}

/**
 * @public Used by server actions; resolves email when omitted.
 */
export async function startCheckoutForTenant(input: {
  tenantId: string;
  plan: StripeCheckoutPlan;
  successPath: string;
  cancelPath: string;
}): Promise<{ url: string }> {
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, input.tenantId) });
  if (!t) {
    throw new Error("Tenant not found.");
  }
  return createTenantStripeCheckoutSession({
    tenantId: input.tenantId,
    plan: input.plan,
    successPath: input.successPath,
    cancelPath: input.cancelPath,
  });
}

/**
 * Opens Stripe-hosted Customer Portal (payment methods, cancellations, invoices) for tenants
 * that already have a Stripe Customer id persisted from Checkout or webhook sync.
 */
export async function createTenantStripeCustomerPortalSession(input: {
  tenantId: string;
  /** Path on this app origin; default `/account/billing` */
  returnPath?: string;
}): Promise<{ url: string }> {
  const row = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });
  if (!row) {
    throw new Error("Tenant not found.");
  }
  const customerId = row.stripeCustomerId?.trim() || null;
  if (!customerId) {
    throw new Error(
      "Billing management is unavailable until this workspace completes its first Stripe subscription checkout (no Stripe customer on file).",
    );
  }
  const raw = input.returnPath?.trim() || "/account/billing";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const origin = getAppPublicOrigin();
  const returnUrl = `${origin}${path}`;

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  if (!session.url) {
    throw new Error("Stripe did not return a Customer Portal URL.");
  }
  return { url: session.url };
}

function priceIdFromSubscriptionItem(
  sub: Stripe.Subscription,
): string | null {
  const first = sub.items.data[0];
  if (!first) {
    return null;
  }
  const p = first.price;
  if (typeof p === "string") {
    return p;
  }
  return p.id;
}

function customerIdString(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) {
    return null;
  }
  if (typeof customer === "string") {
    return customer;
  }
  if ("deleted" in customer && customer.deleted) {
    return null;
  }
  return customer.id;
}

async function findTenantIdForStripeReferences(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<string | null> {
  const customerId = input.stripeCustomerId?.trim() || null;
  const subscriptionId = input.stripeSubscriptionId?.trim() || null;
  if (customerId) {
    const customerTenant = await db.query.tenants.findFirst({
      where: eq(tenants.stripeCustomerId, customerId),
      columns: {
        id: true,
        stripeSubscriptionId: true,
      },
    });
    if (
      customerTenant &&
      (!subscriptionId ||
        !customerTenant.stripeSubscriptionId?.trim() ||
        customerTenant.stripeSubscriptionId.trim() === subscriptionId)
    ) {
      return customerTenant.id;
    }
  }

  if (subscriptionId) {
    const subscriptionTenant = await db.query.tenants.findFirst({
      where: eq(tenants.stripeSubscriptionId, subscriptionId),
      columns: {
        id: true,
      },
    });
    return subscriptionTenant?.id ?? null;
  }
  return null;
}

function isStripeCanceledStatus(status: Stripe.Subscription.Status): boolean {
  return status === "canceled" || status === "unpaid" || status === "incomplete_expired";
}

function logNonCanonicalStripeStatus(
  status: Stripe.Subscription.Status,
  context: Record<string, unknown>,
): void {
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "canceled"
  ) {
    return;
  }

  logStripeBillingEvent("warn", "mapped non-canonical Stripe subscription status", {
    stripeStatus: status,
    ...context,
  });
}

/**
 * Apply Stripe subscription to tenant row + system audit.
 */
export async function updateTenantFromStripeEvent(args: {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  eventType: string;
  stripeEventId: string;
}): Promise<void> {
  await db.transaction(async tx => {
    const tenant = await tx.query.tenants.findFirst({
      where: eq(tenants.id, args.tenantId),
    });
    if (!tenant) {
      throw new Error("Tenant not found for Stripe sync.");
    }
    const before = subscriptionSnapshotFromRow(tenant);
    const nextStripeCustomerId = reconcileStripeCustomerIdFromWebhook(
      tenant.stripeCustomerId,
      args.stripeCustomerId,
    );
    const [u] = await tx
      .update(tenants)
      .set({
        stripeCustomerId: nextStripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        subscriptionPlan: args.subscriptionPlan,
        subscriptionStatus: args.subscriptionStatus,
        trialEndsAt: args.trialEndsAt,
        currentPeriodEndsAt: args.currentPeriodEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, args.tenantId))
      .returning();
    if (!u) {
      throw new Error("Failed to update tenant from Stripe.");
    }
    const after = subscriptionSnapshotFromRow(u);
    const changed = diffSubscriptionKeys(before, after);
    await tx.insert(auditLogs).values({
      tenantId: u.id,
      actorType: "system",
      action: "update",
      entityTable: "tenants",
      entityId: u.id,
      entityLabel: u.name,
      changedFieldsJson: JSON.stringify(changed.length > 0 ? changed : []),
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
      contextJson: JSON.stringify({
        action: "stripe_webhook",
        eventType: args.eventType,
        stripeEventId: args.stripeEventId,
        ...(changed.length === 0 ? { stripeSyncResult: "unchanged" as const } : {}),
      }),
    });
  });
}

function subscriptionDatesFromStripe(
  sub: Stripe.Subscription,
): { trial: Date | null; periodEnd: Date | null } {
  const firstItem = sub.items.data[0];
  const periodEndSec = firstItem?.current_period_end;
  return {
    trial: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    periodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
  };
}

export async function syncTenantFromSubscription(
  sub: Stripe.Subscription,
  eventType: string,
  eventId: string,
  options?: { tenantId?: string | null },
): Promise<void> {
  const stripeCustomerId = customerIdString(sub.customer);
  const stripeSubscriptionId = sub.id;
  const raw =
    options?.tenantId?.trim() ??
    sub.metadata?.[STRIPE_METADATA_TENANT_ID]?.trim() ??
    (await findTenantIdForStripeReferences({
      stripeCustomerId,
      stripeSubscriptionId,
    }));
  if (!raw) {
    logStripeBillingEvent("warn", "subscription sync skipped: missing tenant id", {
      stripeEventId: eventId,
      eventType,
      stripeSubscriptionId,
      stripeCustomerId,
      metadataTenantId: sub.metadata?.[STRIPE_METADATA_TENANT_ID] ?? null,
    });
    return;
  }
  if (!isUuid(raw)) {
    logStripeBillingEvent("warn", "subscription sync skipped: invalid tenant id", {
      stripeEventId: eventId,
      eventType,
      stripeSubscriptionId,
      stripeCustomerId,
      tenantId: raw,
    });
    return;
  }
  const tenantId = raw;
  if (isStripeCanceledStatus(sub.status)) {
    await updateTenantFromStripeEvent({
      tenantId,
      stripeCustomerId,
      stripeSubscriptionId: null,
      subscriptionPlan: "free",
      subscriptionStatus: "canceled",
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      eventType,
      stripeEventId: eventId,
    });
    return;
  }
  const priceId = priceIdFromSubscriptionItem(sub);
  if (!priceId) {
    logStripeBillingEvent("warn", "subscription sync skipped: no price items", {
      stripeEventId: eventId,
      eventType,
      stripeSubscriptionId,
      stripeCustomerId,
      tenantId,
      stripeStatus: sub.status,
    });
    return;
  }
  let plan: TenantSubscriptionPlan;
  try {
    plan = await resolveTenantPlanFromStripePriceId(priceId);
  } catch (e) {
    logStripeBillingEvent("warn", "subscription sync skipped: unmapped Stripe price", {
      stripeEventId: eventId,
      eventType,
      stripeSubscriptionId,
      stripeCustomerId,
      tenantId,
      priceId,
      error:
        e instanceof Error
          ? e.message
          : String(e),
    });
    return;
  }
  const { trial, periodEnd } = subscriptionDatesFromStripe(sub);
  logNonCanonicalStripeStatus(sub.status, {
    stripeEventId: eventId,
    eventType,
    stripeSubscriptionId,
    stripeCustomerId,
    tenantId,
  });
  const status = mapStripeSubscriptionStatus(sub.status);
  await updateTenantFromStripeEvent({
    tenantId,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionPlan: plan,
    subscriptionStatus: status,
    trialEndsAt: trial,
    currentPeriodEndsAt: periodEnd,
    eventType,
    stripeEventId: eventId,
  });
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === "subscription_details") {
    const subRef = parent.subscription_details?.subscription;
    if (subRef) {
      return typeof subRef === "string" ? subRef : subRef.id;
    }
  }
  const legacy = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    }
  ).subscription;
  if (!legacy) {
    return null;
  }
  return typeof legacy === "string" ? legacy : legacy.id;
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
  try {
    await dispatchStripeWebhookEvent(event);
  } catch (err) {
    console.error(
      `[stripe webhook] Processor threw (type=${event.type} id=${event.id})`,
      err,
    );
    throw err;
  }
}

async function dispatchStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (isStripeCatalogWebhookEvent(event.type)) {
    await processStripeCatalogWebhook(event);
    return;
  }

  const stripe = getStripeClient();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        return;
      }
      const subRef = session.subscription;
      if (!subRef) {
        return;
      }
      const subId = typeof subRef === "string" ? subRef : subRef.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      const fromSession = tenantIdFromCheckoutSession(session);
      const fromSubMeta = sub.metadata?.[STRIPE_METADATA_TENANT_ID]?.trim();
      const tenantId =
        fromSession ??
        (fromSubMeta && isUuid(fromSubMeta) ? fromSubMeta : null) ??
        (await findTenantIdForStripeReferences({
          stripeCustomerId: customerIdString(sub.customer),
          stripeSubscriptionId: sub.id,
        }));
      if (!tenantId) {
        logStripeBillingEvent(
          "warn",
          "checkout.session.completed skipped: missing tenant linkage",
          {
            stripeEventId: event.id,
            stripeCheckoutSessionId: session.id,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: customerIdString(sub.customer),
            sessionClientReferenceId: session.client_reference_id ?? null,
            sessionMetadataTenantId:
              session.metadata?.[STRIPE_METADATA_TENANT_ID] ?? null,
            subscriptionMetadataTenantId:
              sub.metadata?.[STRIPE_METADATA_TENANT_ID] ?? null,
          },
        );
        return;
      }
      await syncTenantFromSubscription(sub, event.type, event.id, {
        tenantId,
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncTenantFromSubscription(sub, event.type, event.id);
      return;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionIdFromInvoice(invoice);
      if (!subId) {
        logStripeBillingEvent("warn", "invoice event skipped: missing subscription reference", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: customerIdString(invoice.customer),
        });
        return;
      }
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncTenantFromSubscription(sub, event.type, event.id);
      return;
    }
    default:
      /** Subscribed-but-unhandled event types → no-op (no crash). */
      return;
  }
}
