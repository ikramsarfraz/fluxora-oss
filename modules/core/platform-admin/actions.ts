"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { stripeSaasPaidPlanSchema } from "@/lib/stripe/checkout-plan-schema";
import {
  parseTenantSubscriptionFormForService,
  tenantSubscriptionFormSchema,
} from "@/modules/core/platform-admin/tenants/validators/tenant-subscription-form.schema";
import {
  setTenantActiveByPlatformAdmin,
  updateTenantSubscriptionByPlatformAdmin,
} from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUser } from "@/modules/core/platform-admin/services/platform-users";
import { startCheckoutForTenant } from "@/modules/core/billing/stripe-tenant-billing";
import { syncStripeCatalogFullFromStripeApi } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";

export async function setTenantActiveAction(
  id: string,
  isActive: boolean,
  reason?: string | null,
) {
  const tenant = await setTenantActiveByPlatformAdmin(id, isActive, reason);

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);

  return tenant;
}

export async function updateTenantSubscriptionAction(
  tenantId: string,
  raw: z.input<typeof tenantSubscriptionFormSchema>,
) {
  const input = tenantSubscriptionFormSchema.parse(raw);
  const payload = parseTenantSubscriptionFormForService(input);
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
  await requirePlatformUser();
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
    const pu = await requirePlatformUser();
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
