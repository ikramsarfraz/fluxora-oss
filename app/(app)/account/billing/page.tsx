import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BillingCheckoutFeedback } from "@/components/account/billing-checkout-feedback";
import { BillingSubscriptionRefreshHint } from "@/components/account/billing-subscription-refresh-hint";
import { TenantBillingPortalControls } from "@/components/account/tenant-billing-portal-controls";
import { TenantBillingCatalogSection } from "@/components/account/tenant-billing-catalog";
import { TenantBillingHealthNotice } from "@/components/subscription/tenant-billing-health-notice";
import { PageHeader } from "@/components/page-header";
import { TenantSubscriptionOverview } from "@/components/subscription/tenant-subscription-overview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getUserByAuthUserId } from "@/services/portal-users";
import { getTenantDefaultPaymentMethod } from "@/services/stripe-tenant-billing";
import { getCurrentTenant } from "@/services/tenants";
import { listActivePaidPlansForBillingPage } from "@/services/stripe-catalog";

const BILLING_SNAPSHOT_OBSERVABILITY =
  "Stripe webhooks (Checkout completion, subscription lifecycle, and invoice payment events) refresh this snapshot. Allow a short delay after Stripe actions; duplicate deliveries are recorded in platform Activity with an idempotent outcome when nothing changed.";

export default async function AccountBillingPage(props: {
  searchParams: Promise<{ session_id?: string; success?: string; canceled?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const portalUser = await getUserByAuthUserId(session.user.id);

  if (!portalUser) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Billing</h2>
        <p className="text-muted-foreground text-sm">
          No portal profile is linked to this sign-in yet. Ask an administrator
          to invite you or complete onboarding before managing billing.
        </p>
        <Button variant="outline" className="w-fit" asChild>
          <Link href="/account">Back to account</Link>
        </Button>
      </div>
    );
  }

  const tenant = await getCurrentTenant();
  const params = await props.searchParams;
  const checkoutFeedback = (() => {
    const c = params.canceled;
    if (c === "1" || c === "true") {
      return { kind: "canceled" as const };
    }
    const sessionId = params.session_id ?? null;
    const s = params.success;
    if (s === "1" || s === "true" || sessionId) {
      return { kind: "success" as const, sessionId };
    }
    return null;
  })();

  const hadCanceledCheckout = params.canceled === "1" || params.canceled === "true";
  const bootstrapFromCheckoutSuccess =
    !hadCanceledCheckout &&
    (params.success === "1" ||
      params.success === "true" ||
      !!(params.session_id && params.session_id.trim()));

  const [catalogPlans, defaultPaymentMethod] = await Promise.all([
    listActivePaidPlansForBillingPage(),
    getTenantDefaultPaymentMethod(tenant.id),
  ]);

  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";

  return (
    <div className="@container/main flex flex-1 flex-col gap-6">
      <div className="px-0 pt-2">
        <PageHeader
          title="Billing"
          description="Stripe subscription for this workspace. Offerings below mirror synced Stripe Products and Prices; Stripe-hosted Checkout completes purchase or upgrade."
        />
      </div>
      <div className="grid max-w-6xl gap-4">
        <TenantBillingHealthNotice
          tenant={{
            subscriptionPlan: tenant.subscriptionPlan,
            subscriptionStatus: tenant.subscriptionStatus,
            trialEndsAt: tenant.trialEndsAt,
            currentPeriodEndsAt: tenant.currentPeriodEndsAt,
            stripeCustomerId: tenant.stripeCustomerId ?? null,
          }}
          canManageBilling={canManageBilling}
        />
        {checkoutFeedback ? (
          <BillingCheckoutFeedback
            kind={checkoutFeedback.kind}
            sessionId={checkoutFeedback.kind === "success" ? checkoutFeedback.sessionId : null}
          />
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              Applies to this workspace ({tenant.slug}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantSubscriptionOverview
              subscriptionPlan={tenant.subscriptionPlan}
              subscriptionStatus={tenant.subscriptionStatus}
              trialEndsAt={tenant.trialEndsAt}
              currentPeriodEndsAt={tenant.currentPeriodEndsAt}
              stripeCustomerId={tenant.stripeCustomerId}
              stripeSubscriptionId={tenant.stripeSubscriptionId}
              defaultPaymentMethod={defaultPaymentMethod}
              observabilityNote={BILLING_SNAPSHOT_OBSERVABILITY}
            />
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Stripe Customer Portal
              </p>
              <TenantBillingPortalControls
                canManageBilling={canManageBilling}
                stripeCustomerId={tenant.stripeCustomerId}
              />
            </div>
            <BillingSubscriptionRefreshHint
              snapshotPlan={tenant.subscriptionPlan}
              snapshotStatus={tenant.subscriptionStatus}
              bootstrapFromCheckoutSuccess={bootstrapFromCheckoutSuccess}
            />
          </CardContent>
        </Card>
        <Card id="billing-plans">
          <CardHeader>
            <CardTitle>Choose or change plan</CardTitle>
            <CardDescription>
              {catalogPlans.length > 0
                ? `Active tiers from the cached Stripe catalog (${catalogPlans.length} offer${
                    catalogPlans.length !== 1 ? "s" : ""
                  }).`
                : canManageBilling
                  ? "No paid prices match the cached catalog yet. Use env STRIPE_PRICE_* IDs with the fallback buttons below, or ask a platform admin to sync the Stripe catalog."
                  : "No paid subscription prices are cached yet. Owners or admins see Checkout options once the catalog is synced or STRIPE_PRICE_* IDs are configured."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TenantBillingCatalogSection
              catalogPlans={catalogPlans}
              currentPlan={tenant.subscriptionPlan}
              canManageBilling={canManageBilling}
            />
            {canManageBilling && catalogPlans.length > 0 ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Opens Stripe-hosted Checkout (
                <code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">checkout.session.completed</code>
                {" "}and subscription webhooks update billing fields afterward).
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
