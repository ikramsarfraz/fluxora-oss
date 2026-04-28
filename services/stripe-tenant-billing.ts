import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { auditLogs, tenants } from "@/db/schema";
import { getPreferredBillingEmailForTenant } from "@/services/billing-contacts";
import { getAppPublicOrigin, getStripeClient } from "@/lib/stripe/config";
import type { StripeSaasPaidPlanKey } from "@/lib/stripe/plan-metadata";
import {
  resolveStripePriceIdForPaidPlan,
  resolveTenantPlanFromStripePriceId,
} from "@/lib/stripe/price-to-plan";
import {
  isStripeCatalogWebhookEvent,
  processStripeCatalogWebhook,
} from "@/services/stripe-catalog";
import { mapStripeSubscriptionStatus } from "@/lib/stripe/subscription-status";
import {
  diffSubscriptionKeys,
  subscriptionSnapshotFromRow,
} from "@/lib/tenant-subscription-audit";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

export type StripeCheckoutPlan = StripeSaasPaidPlanKey;

export async function createTenantStripeCheckoutSession(input: {
  tenantId: string;
  plan: StripeCheckoutPlan;
  /** Used when the tenant has no Stripe customer yet */
  customerEmail: string;
  /**
   * Path relative to app origin, e.g. "/account/billing" or "/admin/tenants/xyz"
   * Success URL will receive ?session_id={CHECKOUT_SESSION_ID}
   */
  successPath: string;
  /** Path for cancel, e.g. same as billing page */
  cancelPath: string;
  existingStripeCustomerId: string | null;
}): Promise<{ url: string }> {
  const priceId = await resolveStripePriceIdForPaidPlan(input.plan);
  const origin = getAppPublicOrigin();
  const successPath = input.successPath.startsWith("/")
    ? input.successPath
    : `/${input.successPath}`;
  const cancelPath = input.cancelPath.startsWith("/")
    ? input.cancelPath
    : `/${input.cancelPath}`;
  // Stripe replaces {CHECKOUT_SESSION_ID} — must be a literal in the string.
  const successUrl = `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${cancelPath}`;

  const stripe = getStripeClient();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.tenantId,
    metadata: { tenantId: input.tenantId },
    subscription_data: {
      metadata: { tenantId: input.tenantId },
    },
  };
  if (input.existingStripeCustomerId) {
    params.customer = input.existingStripeCustomerId;
  } else {
    const email = input.customerEmail.trim();
    if (!email) {
      throw new Error("A billing contact email is required for Stripe Checkout.");
    }
    params.customer_email = email;
  }

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
  /** Optional override; default is preferred portal user email */
  customerEmailOverride?: string | null;
}): Promise<{ url: string }> {
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, input.tenantId) });
  if (!t) {
    throw new Error("Tenant not found.");
  }
  const email =
    input.customerEmailOverride?.trim() ||
    (await getPreferredBillingEmailForTenant(input.tenantId)) ||
    null;
  if (!email) {
    throw new Error("No billing email could be determined for this tenant.");
  }
  return createTenantStripeCheckoutSession({
    tenantId: input.tenantId,
    plan: input.plan,
    customerEmail: email,
    successPath: input.successPath,
    cancelPath: input.cancelPath,
    existingStripeCustomerId: t.stripeCustomerId,
  });
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

/**
 * Apply Stripe subscription to tenant row + system audit.
 */
export async function updateTenantFromStripeEvent(args: {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: import("@/lib/tenant-subscription").TenantSubscriptionStatus;
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
    const [u] = await tx
      .update(tenants)
      .set({
        stripeCustomerId: args.stripeCustomerId,
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
    if (changed.length === 0) {
      return;
    }
    await tx.insert(auditLogs).values({
      tenantId: u.id,
      actorType: "system",
      action: "update",
      entityTable: "tenants",
      entityId: u.id,
      entityLabel: u.name,
      changedFieldsJson: JSON.stringify(changed),
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
      contextJson: JSON.stringify({
        action: "stripe_webhook",
        eventType: args.eventType,
        stripeEventId: args.stripeEventId,
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
  const tenantId = options?.tenantId ?? sub.metadata?.tenantId;
  if (!tenantId) {
    console.warn("Stripe subscription missing tenantId metadata; skipping sync.");
    return;
  }
  if (sub.status === "canceled" && eventType === "customer.subscription.deleted") {
    const cust = customerIdString(sub.customer);
    await updateTenantFromStripeEvent({
      tenantId,
      stripeCustomerId: cust,
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
    console.warn("Stripe subscription has no price items; skipping.");
    return;
  }
  let plan: TenantSubscriptionPlan;
  try {
    plan = await resolveTenantPlanFromStripePriceId(priceId);
  } catch (e) {
    console.warn(e);
    return;
  }
  const { trial, periodEnd } = subscriptionDatesFromStripe(sub);
  const status = mapStripeSubscriptionStatus(sub.status);
  const cust = customerIdString(sub.customer);
  const subId = sub.id;
  await updateTenantFromStripeEvent({
    tenantId,
    stripeCustomerId: cust,
    stripeSubscriptionId: subId,
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
  if (!parent || parent.type !== "subscription_details") {
    return null;
  }
  const sub = parent.subscription_details?.subscription;
  if (!sub) {
    return null;
  }
  return typeof sub === "string" ? sub : sub.id;
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
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
      const tenantId = session.metadata?.tenantId ?? sub.metadata?.tenantId;
      if (!tenantId) {
        console.warn("Checkout session / subscription missing tenantId metadata.");
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
        return;
      }
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncTenantFromSubscription(sub, event.type, event.id);
      return;
    }
    default:
      return;
  }
}
