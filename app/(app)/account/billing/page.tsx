import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BillingCheckoutFeedback } from "@/components/account/billing-checkout-feedback";
import { BillingSubscriptionRefreshHint } from "@/components/account/billing-subscription-refresh-hint";
import { TenantBillingPortalControls } from "@/components/account/tenant-billing-portal-controls";
import { TenantBillingCatalogSection } from "@/components/account/tenant-billing-catalog";
import { PageHeader } from "@/components/page-header";
import {
  PlanOverviewCard,
  UsageCard,
  BillingStateBanner,
} from "@/components/billing/billing-components";
import { deriveBillingBannerState } from "@/lib/billing-utils";
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
import { getCurrentTenantPlanUsage } from "@/services/subscription-usage";
import { getCurrentTenant } from "@/services/tenants";
import { listActivePaidPlansForBillingPage } from "@/services/stripe-catalog";
import {
  formatTenantPaymentMethodSummary,
  formatTenantPaymentMethodExpiryLine,
} from "@/lib/subscription-display";

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
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">No Profile Linked</h2>
          <p className="text-sm text-muted-foreground">
            No portal profile is linked to this sign-in yet. Ask an administrator
            to invite you or complete onboarding before managing billing.
          </p>
        </div>
        <Button variant="outline" asChild>
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

  const [catalogPlans, defaultPaymentMethod, usage] = await Promise.all([
    listActivePaidPlansForBillingPage(),
    getTenantDefaultPaymentMethod(tenant.id),
    getCurrentTenantPlanUsage(),
  ]);

  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";

  const bannerState = deriveBillingBannerState({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
  });

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 pb-8">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <PageHeader
          title="Billing"
          description="Manage your subscription, view usage, and update payment details."
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column - Main Content */}
        <div className="flex flex-col gap-6">
          {/* State Banner (if applicable) */}
          {bannerState && (
            <BillingStateBanner
              state={bannerState}
              canManageBilling={canManageBilling}
            />
          )}

          {/* Checkout Feedback */}
          {checkoutFeedback && (
            <BillingCheckoutFeedback
              kind={checkoutFeedback.kind}
              sessionId={checkoutFeedback.kind === "success" ? checkoutFeedback.sessionId : null}
            />
          )}

          {/* Plan Overview Card */}
          <PlanOverviewCard
            subscriptionPlan={tenant.subscriptionPlan}
            subscriptionStatus={tenant.subscriptionStatus}
            trialEndsAt={tenant.trialEndsAt}
            currentPeriodEndsAt={tenant.currentPeriodEndsAt}
            canManageBilling={canManageBilling}
            stripeCustomerId={tenant.stripeCustomerId ?? null}
          />

          {/* Usage Card */}
          <UsageCard usage={usage} showUpgradeCta />

          {/* Refresh Hint */}
          <BillingSubscriptionRefreshHint
            snapshotPlan={tenant.subscriptionPlan}
            snapshotStatus={tenant.subscriptionStatus}
            bootstrapFromCheckoutSuccess={bootstrapFromCheckoutSuccess}
          />

          {/* Plans Section */}
          <Card id="billing-plans">
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                {catalogPlans.length > 0
                  ? "Choose the plan that best fits your needs. Changes take effect immediately."
                  : canManageBilling
                    ? "No paid plans are available yet. Contact support or wait for catalog sync."
                    : "No subscription plans are available at this time."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TenantBillingCatalogSection
                catalogPlans={catalogPlans}
                currentPlan={tenant.subscriptionPlan}
                canManageBilling={canManageBilling}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <TenantBillingPortalControls
                canManageBilling={canManageBilling}
                stripeCustomerId={tenant.stripeCustomerId}
              />
              {canManageBilling && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="#billing-plans">
                    View all plans
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Method Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              {defaultPaymentMethod ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-muted/50">
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {formatTenantPaymentMethodSummary(defaultPaymentMethod)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTenantPaymentMethodExpiryLine(defaultPaymentMethod)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payment method on file. Add one during checkout.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Workspace Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Workspace ID</dt>
                  <dd className="font-mono text-xs text-foreground">{tenant.slug}</dd>
                </div>
                {tenant.stripeCustomerId && (
                  <div>
                    <dt className="text-muted-foreground">Stripe Customer</dt>
                    <dd className="truncate font-mono text-xs text-foreground">
                      {tenant.stripeCustomerId}
                    </dd>
                  </div>
                )}
                {tenant.stripeSubscriptionId && (
                  <div>
                    <dt className="text-muted-foreground">Subscription ID</dt>
                    <dd className="truncate font-mono text-xs text-foreground">
                      {tenant.stripeSubscriptionId}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
