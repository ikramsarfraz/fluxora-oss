"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { stripeSaasPaidPlanSchema } from "@/lib/stripe/checkout-plan-schema";
import { requirePlatformUser } from "@/services/platform-users";
import { startCheckoutForTenant } from "@/services/stripe-tenant-billing";

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
