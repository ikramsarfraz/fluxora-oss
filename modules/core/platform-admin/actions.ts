"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import {
  stripeBillingIntervalSchema,
  stripeSaasPaidPlanSchema,
} from "@/lib/stripe/checkout-plan-schema";
import { PLATFORM_STRIPE_CATALOG_ROLES } from "@/modules/core/platform-admin/stripe-catalog/permissions";
import { PLATFORM_TENANTS_EDIT_ROLES } from "@/modules/core/platform-admin/tenants/permissions";
import {
  parseTenantSubscriptionFormForService,
  tenantSubscriptionFormSchema,
} from "@/modules/core/platform-admin/tenants/validators/tenant-subscription-form.schema";
import {
  bulkSetTenantsActiveByPlatformAdmin,
  compTenantByPlatformAdmin,
  setTenantActiveByPlatformAdmin,
  uncompTenantByPlatformAdmin,
  updateTenantSubscriptionByPlatformAdmin,
} from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import { setTenantFeatureAction } from "@/modules/core/feature-flags/actions";
import { FEATURES } from "@/modules/core/feature-flags/constants";
import { startCheckoutForTenant } from "@/modules/core/billing/stripe-tenant-billing";
import { syncStripeCatalogFullFromStripeApi } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";
import {
  applyDiscountToTenant,
  createPromotionCodeForCoupon,
  createStripeCoupon,
  listStripeCoupons,
  removeDiscountFromTenant,
  type CouponSummary,
} from "@/modules/core/billing/stripe-discounts";

export async function setTenantActiveAction(
  id: string,
  isActive: boolean,
  reason?: string | null,
) {
  await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
  recordActionBreadcrumb({
    action: "platform_admin.set_tenant_active",
    tenantId: id,
    data: { isActive, hasReason: Boolean(reason?.trim()) },
  });
  const tenant = await setTenantActiveByPlatformAdmin(id, isActive, reason);

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);

  return tenant;
}

const bulkSetTenantActiveSchema = z.object({
  tenantIds: z.array(z.uuid()).min(1).max(100),
  isActive: z.boolean(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function bulkSetTenantActiveAction(
  raw: z.input<typeof bulkSetTenantActiveSchema>,
): Promise<
  | { ok: true; updatedCount: number; skippedCount: number }
  | { ok: false; message: string }
> {
  try {
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    const input = bulkSetTenantActiveSchema.parse(raw);
    recordActionBreadcrumb({
      action: "platform_admin.bulk_set_tenant_active",
      data: {
        count: input.tenantIds.length,
        isActive: input.isActive,
        hasReason: Boolean(input.reason),
      },
    });
    const result = await bulkSetTenantsActiveByPlatformAdmin({
      tenantIds: input.tenantIds,
      isActive: input.isActive,
      reason: input.reason ?? null,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/tenants");
    for (const id of input.tenantIds) {
      revalidatePath(`/admin/tenants/${id}`);
    }
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Bulk update failed.",
    };
  }
}

export async function updateTenantSubscriptionAction(
  tenantId: string,
  raw: z.input<typeof tenantSubscriptionFormSchema>,
) {
  await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
  const input = tenantSubscriptionFormSchema.parse(raw);
  const payload = parseTenantSubscriptionFormForService(input);
  recordActionBreadcrumb({
    action: "platform_admin.update_tenant_subscription",
    tenantId,
    data: {
      plan: payload.subscriptionPlan,
      status: payload.subscriptionStatus,
      hasStripeCustomer: Boolean(payload.stripeCustomerId),
      hasStripeSubscription: Boolean(payload.stripeSubscriptionId),
    },
  });
  const updated = await updateTenantSubscriptionByPlatformAdmin(
    tenantId,
    payload,
  );
  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/tenants/${tenantId}`);
  return updated;
}

export async function startPlatformAdminStripeCheckoutAction(
  tenantId: string,
  plan: unknown,
  interval?: unknown,
): Promise<{ url: string }> {
  const id = z.uuid().parse(tenantId);
  const p = stripeSaasPaidPlanSchema.parse(plan);
  const i = stripeBillingIntervalSchema.parse(interval);
  await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
  recordActionBreadcrumb({
    action: "platform_admin.start_stripe_checkout",
    tenantId: id,
    data: { plan: p, interval: i },
  });
  const { url } = await startCheckoutForTenant({
    tenantId: id,
    plan: p,
    interval: i,
    successPath: `/admin/tenants/${id}`,
    cancelPath: `/admin/tenants/${id}`,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/subscriptions");
  return { url };
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : typeof e === "string" ? e : fallback;
}

export async function listStripeCouponsAction(): Promise<
  { ok: true; coupons: CouponSummary[] } | { ok: false; message: string }
> {
  try {
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    const coupons = await listStripeCoupons();
    return { ok: true, coupons };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to load coupons.") };
  }
}

const createCouponSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(["percent", "amount"]),
    percentOff: z.number().positive().max(100).optional().nullable(),
    amountOffCents: z.number().int().positive().optional().nullable(),
    currency: z.string().trim().length(3).optional().nullable(),
    duration: z.enum(["once", "repeating", "forever"]),
    durationInMonths: z.number().int().positive().max(120).optional().nullable(),
  })
  .strip();

export async function createStripeCouponAction(
  raw: z.input<typeof createCouponSchema>,
): Promise<{ ok: true; coupon: CouponSummary } | { ok: false; message: string }> {
  try {
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    const input = createCouponSchema.parse(raw);
    recordActionBreadcrumb({
      action: "platform_admin.create_stripe_coupon",
      data: { kind: input.kind, duration: input.duration },
    });
    const coupon = await createStripeCoupon({
      name: input.name,
      percentOff: input.kind === "percent" ? input.percentOff ?? null : null,
      amountOffCents: input.kind === "amount" ? input.amountOffCents ?? null : null,
      currency: input.kind === "amount" ? input.currency ?? null : null,
      duration: input.duration,
      durationInMonths: input.durationInMonths ?? null,
    });
    return { ok: true, coupon };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to create coupon.") };
  }
}

const createPromoSchema = z
  .object({
    couponId: z.string().trim().min(1),
    code: z.string().trim().min(1).max(64).optional().nullable(),
    maxRedemptions: z.number().int().positive().optional().nullable(),
  })
  .strip();

export async function createPromotionCodeAction(
  raw: z.input<typeof createPromoSchema>,
): Promise<{ ok: true; id: string; code: string } | { ok: false; message: string }> {
  try {
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    const input = createPromoSchema.parse(raw);
    recordActionBreadcrumb({
      action: "platform_admin.create_promotion_code",
      data: { hasCustomCode: Boolean(input.code) },
    });
    const result = await createPromotionCodeForCoupon({
      couponId: input.couponId,
      code: input.code ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to create promotion code.") };
  }
}

export async function applyTenantDiscountAction(
  tenantId: string,
  couponId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const id = z.uuid().parse(tenantId);
    const coupon = z.string().trim().min(1).parse(couponId);
    const pu = await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    recordActionBreadcrumb({
      action: "platform_admin.apply_tenant_discount",
      tenantId: id,
    });
    await applyDiscountToTenant({ tenantId: id, couponId: coupon, platformUserId: pu.id });
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to apply discount.") };
  }
}

export async function removeTenantDiscountAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const id = z.uuid().parse(tenantId);
    const pu = await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    recordActionBreadcrumb({
      action: "platform_admin.remove_tenant_discount",
      tenantId: id,
    });
    await removeDiscountFromTenant({ tenantId: id, platformUserId: pu.id });
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to remove discount.") };
  }
}

const compReasonSchema = z.string().trim().max(500).optional().nullable();

export async function compTenantAction(
  tenantId: string,
  reason?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const id = z.uuid().parse(tenantId);
    const r = compReasonSchema.parse(reason);
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    recordActionBreadcrumb({
      action: "platform_admin.comp_tenant",
      tenantId: id,
      data: { hasReason: Boolean(r) },
    });
    await compTenantByPlatformAdmin({ tenantId: id, reason: r ?? null });
    revalidatePath("/admin");
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to comp tenant.") };
  }
}

export async function uncompTenantAction(
  tenantId: string,
  reason?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const id = z.uuid().parse(tenantId);
    const r = compReasonSchema.parse(reason);
    await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
    recordActionBreadcrumb({
      action: "platform_admin.uncomp_tenant",
      tenantId: id,
      data: { hasReason: Boolean(r) },
    });
    await uncompTenantByPlatformAdmin({ tenantId: id, reason: r ?? null });
    revalidatePath("/admin");
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Failed to end comp.") };
  }
}

export async function syncStripeCatalogAdminAction(): Promise<
  | { ok: true; productsUpserted: number; pricesUpserted: number }
  | { ok: false; message: string }
> {
  try {
    const pu = await requirePlatformUserInRoles(PLATFORM_STRIPE_CATALOG_ROLES);
    recordActionBreadcrumb({
      action: "platform_admin.sync_stripe_catalog",
      data: { platformUserId: pu.id },
    });
    const result = await syncStripeCatalogFullFromStripeApi({
      actorType: "platform_user",
      platformUserId: pu.id,
    });
    revalidatePath("/admin/subscriptions");
    revalidatePath("/admin/stripe-catalog");
    return { ok: true, ...result };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "Sync failed.";
    return { ok: false, message: msg };
  }
}

/**
 * Platform-admin per-tenant kill switch for enterprise SSO (the `core.sso`
 * feature flag). Properly gated — unlike the bare `setTenantFeatureAction`.
 */
export async function setTenantSsoEnabledAction(
  tenantId: unknown,
  enabled: unknown,
): Promise<{ ok: true }> {
  const id = z.string().uuid().parse(tenantId);
  const on = z.boolean().parse(enabled);
  await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
  recordActionBreadcrumb({
    action: "platform_admin.set_tenant_sso",
    tenantId: id,
    data: { enabled: on },
  });
  await setTenantFeatureAction(id, FEATURES.CORE_SSO, on);
  revalidatePath(`/admin/tenants/${id}`);
  return { ok: true };
}
