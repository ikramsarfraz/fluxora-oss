"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import { stripeSaasPaidPlanSchema } from "@/lib/stripe/checkout-plan-schema";
import { PLATFORM_STRIPE_CATALOG_ROLES } from "@/modules/core/platform-admin/stripe-catalog/permissions";
import { PLATFORM_TENANTS_EDIT_ROLES } from "@/modules/core/platform-admin/tenants/permissions";
import {
  parseTenantSubscriptionFormForService,
  tenantSubscriptionFormSchema,
} from "@/modules/core/platform-admin/tenants/validators/tenant-subscription-form.schema";
import {
  bulkSetTenantsActiveByPlatformAdmin,
  setTenantActiveByPlatformAdmin,
  updateTenantSubscriptionByPlatformAdmin,
} from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import { startCheckoutForTenant } from "@/modules/core/billing/stripe-tenant-billing";
import { syncStripeCatalogFullFromStripeApi } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";

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
): Promise<{ url: string }> {
  const id = z.uuid().parse(tenantId);
  const p = stripeSaasPaidPlanSchema.parse(plan);
  await requirePlatformUserInRoles(PLATFORM_TENANTS_EDIT_ROLES);
  recordActionBreadcrumb({
    action: "platform_admin.start_stripe_checkout",
    tenantId: id,
    data: { plan: p },
  });
  const { url } = await startCheckoutForTenant({
    tenantId: id,
    plan: p,
    successPath: `/admin/tenants/${id}`,
    cancelPath: `/admin/tenants/${id}`,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/subscriptions");
  return { url };
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
