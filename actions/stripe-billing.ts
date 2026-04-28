"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStripeClient } from "@/lib/stripe/config";
import {
  getCurrentPortalUser,
  requireAdminPortalUser,
} from "@/services/portal-users";
import { startCheckoutForTenant } from "@/services/stripe-tenant-billing";

const paidPlanSchema = z.enum(["starter", "growth", "enterprise"]);

export async function startTenantAdminStripeCheckoutAction(
  plan: z.infer<typeof paidPlanSchema>,
): Promise<{ url: string }> {
  const p = paidPlanSchema.parse(plan);
  const admin = await requireAdminPortalUser();
  const billingPath = "/account/billing";
  const { url } = await startCheckoutForTenant({
    tenantId: admin.tenantId,
    plan: p,
    successPath: billingPath,
    cancelPath: billingPath,
  });
  revalidatePath("/account");
  revalidatePath(billingPath);
  revalidatePath("/dashboard");
  return { url };
}

/** After Checkout redirect (`?session_id=` from success URL), verify the Stripe session belongs to this tenant — same retrieval pattern as the Next.js Stripe example apps. */
export async function getStripeCheckoutSessionReturnLabels(sessionId: string): Promise<
  | { ok: true; paymentStatus: string; customerEmail: string | null }
  | { ok: false }
> {
  const trimmed = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!trimmed.startsWith("cs_")) {
    return { ok: false };
  }

  const me = await getCurrentPortalUser();
  const stripe = getStripeClient();
  const sess = await stripe.checkout.sessions.retrieve(trimmed);
  const tenantId = sess.metadata?.tenantId ?? sess.client_reference_id;
  if (tenantId !== me.tenantId) {
    return { ok: false };
  }
  const email =
    sess.customer_details?.email ?? sess.customer_email ?? null;
  return {
    ok: true,
    paymentStatus: sess.payment_status ?? "unknown",
    customerEmail: email,
  };
}
