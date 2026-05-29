import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { auditLogs, tenants } from "@/db/schema";
import { getStripeClient } from "@/lib/stripe/config";
import type { CouponSummary } from "@/modules/core/billing/stripe-discounts/lib/coupon-format";

function mapStripeCouponToSummary(coupon: Stripe.Coupon): CouponSummary {
  return {
    id: coupon.id,
    name: coupon.name ?? null,
    percentOff: coupon.percent_off ?? null,
    amountOffCents: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
    duration: coupon.duration,
    durationInMonths: coupon.duration_in_months ?? null,
    valid: coupon.valid,
  };
}

/** Active subscription means a live Stripe sub we can mutate (excludes canceled/comped). */
function hasMutableStripeSubscription(tenant: {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
}): tenant is { stripeSubscriptionId: string; subscriptionStatus: string } {
  return (
    Boolean(tenant.stripeSubscriptionId?.trim()) &&
    (tenant.subscriptionStatus === "active" ||
      tenant.subscriptionStatus === "trialing" ||
      tenant.subscriptionStatus === "past_due")
  );
}

export async function listStripeCoupons(limit = 100): Promise<CouponSummary[]> {
  const stripe = getStripeClient();
  const list = await stripe.coupons.list({ limit });
  return list.data.map(mapStripeCouponToSummary);
}

export type CreateStripeCouponInput = {
  name: string;
  /** Exactly one of percentOff / amountOffCents must be provided. */
  percentOff?: number | null;
  amountOffCents?: number | null;
  /** Required (lowercase) when amountOffCents is used; ignored for percentOff. */
  currency?: string | null;
  duration: "once" | "repeating" | "forever";
  /** Required when duration === "repeating". */
  durationInMonths?: number | null;
};

export async function createStripeCoupon(
  input: CreateStripeCouponInput,
): Promise<CouponSummary> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Coupon name is required.");
  }
  const hasPercent = input.percentOff != null;
  const hasAmount = input.amountOffCents != null;
  if (hasPercent === hasAmount) {
    throw new Error("Provide exactly one of a percent-off or an amount-off discount.");
  }

  const params: Stripe.CouponCreateParams = {
    name,
    duration: input.duration,
  };

  if (hasPercent) {
    const pct = Number(input.percentOff);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error("Percent off must be between 0 and 100.");
    }
    params.percent_off = pct;
  } else {
    const amount = Number(input.amountOffCents);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("Amount off must be a positive whole number of cents.");
    }
    const currency = input.currency?.trim().toLowerCase();
    if (!currency) {
      throw new Error("Currency is required for an amount-off coupon.");
    }
    params.amount_off = amount;
    params.currency = currency;
  }

  if (input.duration === "repeating") {
    const months = Number(input.durationInMonths);
    if (!Number.isInteger(months) || months <= 0) {
      throw new Error("Duration in months is required for a repeating coupon.");
    }
    params.duration_in_months = months;
  }

  const coupon = await stripeCouponCreate(params);
  return mapStripeCouponToSummary(coupon);
}

function stripeCouponCreate(params: Stripe.CouponCreateParams) {
  return getStripeClient().coupons.create(params);
}

export type CreatePromotionCodeInput = {
  couponId: string;
  /** Optional customer-facing code; Stripe auto-generates one when omitted. */
  code?: string | null;
  maxRedemptions?: number | null;
};

export async function createPromotionCodeForCoupon(
  input: CreatePromotionCodeInput,
): Promise<{ id: string; code: string }> {
  const couponId = input.couponId.trim();
  if (!couponId) {
    throw new Error("Coupon id is required.");
  }
  const stripe = getStripeClient();
  const params: Stripe.PromotionCodeCreateParams = { coupon: couponId };
  const code = input.code?.trim();
  if (code) {
    params.code = code;
  }
  if (input.maxRedemptions != null) {
    const max = Number(input.maxRedemptions);
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error("Max redemptions must be a positive whole number.");
    }
    params.max_redemptions = max;
  }
  const promo = await stripe.promotionCodes.create(params);
  return { id: promo.id, code: promo.code };
}

export async function getTenantBillingDiscount(
  tenantId: string,
): Promise<CouponSummary | null> {
  const row = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { stripeCouponId: true },
  });
  const couponId = row?.stripeCouponId?.trim();
  if (!couponId) {
    return null;
  }
  try {
    const coupon = await getStripeClient().coupons.retrieve(couponId);
    if ("deleted" in coupon && coupon.deleted) {
      return null;
    }
    return mapStripeCouponToSummary(coupon as Stripe.Coupon);
  } catch {
    // Coupon was deleted in Stripe; surface as "no discount" rather than throwing.
    return null;
  }
}

async function writeTenantDiscountAudit(args: {
  tenantId: string;
  tenantName: string;
  platformUserId: string;
  before: string | null;
  after: string | null;
}): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: args.tenantId,
    actorType: "platform_user",
    actorPlatformUserId: args.platformUserId,
    action: "update",
    entityTable: "tenants",
    entityId: args.tenantId,
    entityLabel: args.tenantName,
    changedFieldsJson: JSON.stringify(["stripeCouponId"]),
    beforeJson: JSON.stringify({ stripeCouponId: args.before }),
    afterJson: JSON.stringify({ stripeCouponId: args.after }),
    contextJson: JSON.stringify({ action: "update_tenant_billing_discount" }),
  });
}

export async function applyDiscountToTenant(input: {
  tenantId: string;
  couponId: string;
  platformUserId: string;
}): Promise<void> {
  const couponId = input.couponId.trim();
  if (!couponId) {
    throw new Error("Coupon id is required.");
  }
  const stripe = getStripeClient();

  const coupon = await stripe.coupons.retrieve(couponId);
  if ("deleted" in coupon && coupon.deleted) {
    throw new Error("That coupon no longer exists in Stripe.");
  }
  if (!(coupon as Stripe.Coupon).valid) {
    throw new Error("That coupon is no longer valid (expired or fully redeemed).");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });
  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  // Apply to the live subscription first so a Stripe error surfaces before we
  // persist intent; if the tenant has no live sub, Checkout will pick it up.
  if (hasMutableStripeSubscription(tenant)) {
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      discounts: [{ coupon: couponId }],
    });
  }

  const before = tenant.stripeCouponId?.trim() || null;
  await db.transaction(async tx => {
    await tx
      .update(tenants)
      .set({ stripeCouponId: couponId, updatedAt: new Date() })
      .where(eq(tenants.id, input.tenantId));
    await writeTenantDiscountAudit({
      tenantId: tenant.id,
      tenantName: tenant.name,
      platformUserId: input.platformUserId,
      before,
      after: couponId,
    });
  });
}

export async function removeDiscountFromTenant(input: {
  tenantId: string;
  platformUserId: string;
}): Promise<void> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });
  if (!tenant) {
    throw new Error("Tenant not found.");
  }
  const before = tenant.stripeCouponId?.trim() || null;
  if (!before) {
    return;
  }

  if (hasMutableStripeSubscription(tenant)) {
    try {
      await getStripeClient().subscriptions.deleteDiscount(
        tenant.stripeSubscriptionId,
      );
    } catch {
      // Subscription may already have no discount; clearing intent is enough.
    }
  }

  await db.transaction(async tx => {
    await tx
      .update(tenants)
      .set({ stripeCouponId: null, updatedAt: new Date() })
      .where(eq(tenants.id, input.tenantId));
    await writeTenantDiscountAudit({
      tenantId: tenant.id,
      tenantName: tenant.name,
      platformUserId: input.platformUserId,
      before,
      after: null,
    });
  });
}
