"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  parseTenantSubscriptionFormForService,
  tenantSubscriptionFormSchema,
} from "@/modules/core/platform-admin/tenants/validators/tenant-subscription-form.schema";
import {
  setTenantActiveByPlatformAdmin,
  updateTenantSubscriptionByPlatformAdmin,
} from "@/modules/core/platform-admin/services/platform-admin";

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
