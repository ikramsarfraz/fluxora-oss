"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { startCheckoutForTenant } from "@/services/stripe-tenant-billing";
import { requirePlatformUser } from "@/services/platform-users";

const paidPlanSchema = z.enum(["starter", "growth", "enterprise"]);

export async function startPlatformAdminStripeCheckoutAction(
  tenantId: string,
  plan: z.infer<typeof paidPlanSchema>,
): Promise<{ url: string }> {
  const id = z.string().uuid().parse(tenantId);
  const p = paidPlanSchema.parse(plan);
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
