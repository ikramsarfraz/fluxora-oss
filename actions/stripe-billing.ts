"use server";

import { revalidatePath } from "next/cache";
import { getStripeClient } from "@/lib/stripe/config";
import { tenantIdFromCheckoutSession } from "@/lib/stripe/checkout-tenant-resolution";
import { stripeSaasPaidPlanSchema } from "@/lib/stripe/checkout-plan-schema";
import {
  getCurrentPortalUser,
  requireAdminPortalUser,
} from "@/modules/shared/services/portal-users";
import {
  createTenantStripeCustomerPortalSession,
  startCheckoutForTenant,
} from "@/modules/core/billing/stripe-tenant-billing";

export async function startTenantAdminStripeCheckoutAction(
  plan: unknown,
): Promise<{ url: string }> {
  const p = stripeSaasPaidPlanSchema.parse(plan);
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

export async function startTenantAdminStripeCustomerPortalAction(): Promise<{
  url: string;
}> {
  const admin = await requireAdminPortalUser();
  const billingPath = "/account/billing";
  const { url } = await createTenantStripeCustomerPortalSession({
    tenantId: admin.tenantId,
    returnPath: billingPath,
  });
  revalidatePath("/account");
  revalidatePath(billingPath);
  revalidatePath("/dashboard");
  return { url };
}

/** After Checkout redirect (`?success=1&session_id=` or legacy `?session_id=`), verify Stripe session server-side when possible. */
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
  const tenantId =
    tenantIdFromCheckoutSession(sess) ?? null;
  if (!tenantId || tenantId !== me.tenantId) {
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
