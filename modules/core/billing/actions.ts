"use server";

import { revalidatePath } from "next/cache";
import { getStripeClient } from "@/lib/stripe/config";
import { tenantIdFromCheckoutSession } from "@/lib/stripe/checkout-tenant-resolution";
import {
  stripeBillingIntervalSchema,
  stripeSaasPaidPlanSchema,
} from "@/lib/stripe/checkout-plan-schema";
import {
  getCurrentPortalUser,
  requireAdminPortalUser,
} from "@/modules/shared/services/portal-users";
import {
  createTenantStripeCustomerPortalSession,
  releaseTenantScheduledSubscriptionChange,
  startCheckoutForTenant,
} from "@/modules/core/billing/stripe-tenant-billing";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";

const BILLING_PATH = "/settings/billing/plan-and-usage";

export async function startTenantAdminStripeCheckoutAction(
  plan: unknown,
  interval?: unknown,
): Promise<{ url: string }> {
  const p = stripeSaasPaidPlanSchema.parse(plan);
  const i = stripeBillingIntervalSchema.parse(interval);
  const admin = await requireAdminPortalUser();
  recordActionBreadcrumb({
    action: "billing.start_checkout",
    tenantId: admin.tenantId,
    data: { plan: p, interval: i },
  });
  const billingPath = BILLING_PATH;
  const { url } = await startCheckoutForTenant({
    tenantId: admin.tenantId,
    plan: p,
    interval: i,
    successPath: billingPath,
    cancelPath: billingPath,
  });
  revalidatePath("/settings/account/profile");
  revalidatePath(billingPath);
  revalidatePath("/dashboard");
  return { url };
}

/**
 * Cancel a pending scheduled subscription change (downgrade) so the tenant
 * stays on its current plan. Releases the Stripe subscription schedule.
 */
export async function cancelTenantScheduledChangeAction(): Promise<{
  ok: boolean;
}> {
  const admin = await requireAdminPortalUser();
  recordActionBreadcrumb({
    action: "billing.cancel_scheduled_change",
    tenantId: admin.tenantId,
  });
  await releaseTenantScheduledSubscriptionChange(admin.tenantId);
  revalidatePath(BILLING_PATH);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function startTenantAdminStripeCustomerPortalAction(): Promise<{
  url: string;
}> {
  const admin = await requireAdminPortalUser();
  const billingPath = "/settings/billing/plan-and-usage";
  const { url } = await createTenantStripeCustomerPortalSession({
    tenantId: admin.tenantId,
    returnPath: billingPath,
  });
  revalidatePath("/settings/account/profile");
  revalidatePath(billingPath);
  revalidatePath("/dashboard");
  return { url };
}

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
  const tenantId = tenantIdFromCheckoutSession(sess) ?? null;
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
