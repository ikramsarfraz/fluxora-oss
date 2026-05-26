import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreditCard, Building2, ExternalLink } from "lucide-react";

import { BillingCheckoutFeedback } from "@/modules/core/billing/components/account/billing-checkout-feedback";
import { BillingSubscriptionRefreshHint } from "@/modules/core/billing/components/account/billing-subscription-refresh-hint";
import { TenantBillingPortalControls } from "@/modules/core/billing/components/account/tenant-billing-portal-controls";
import { TenantBillingCatalogSection } from "@/modules/core/billing/components/account/tenant-billing-catalog";
import { PageHeader } from "@/components/page-header";
import {
  PlanOverviewCard,
  UsageCard,
  BillingStateBanner,
} from "@/modules/core/billing/components/billing-components";
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
import { getUserByAuthUserId } from "@/modules/shared/services/portal-users";
import { getTenantDefaultPaymentMethod } from "@/modules/core/billing/stripe-tenant-billing";
import { getCurrentTenantPlanUsage } from "@/modules/core/billing/services/subscription-usage";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { listActivePaidPlansForBillingPage } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";
import {
  formatTenantPaymentMethodSummary,
  formatTenantPaymentMethodExpiryLine,
} from "@/lib/subscription-display";

export default async function SettingsBillingPlanAndUsagePage(props: {
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
          <h2 className="text-xl font-medium tracking-tight">No Profile Linked</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No portal profile is linked to this sign-in yet. Ask an administrator
            to invite you or complete onboarding before managing billing.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/account/profile">Back to account</Link>
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
    <div className="@container/main flex flex-1 flex-col gap-8 pb-8">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <PageHeader
          title="Fluxora Billing"
          description="Manage your subscription, view usage, and update payment details."
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
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
          <Card id="billing-plans" className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                {catalogPlans.length > 0
                  ? "Choose the plan that best fits your needs. Changes take effect immediately."
                  : canManageBilling
                    ? "No paid plans are available yet. Contact support or wait for catalog sync."
                    : "No subscription plans are available at this time."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <TenantBillingCatalogSection
                catalogPlans={catalogPlans}
                currentPlan={tenant.subscriptionPlan}
                canManageBilling={canManageBilling}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Billing Actions Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Billing Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <TenantBillingPortalControls
                canManageBilling={canManageBilling}
                stripeCustomerId={tenant.stripeCustomerId}
              />
              {canManageBilling && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href="#billing-plans">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View all plans
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Method Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {defaultPaymentMethod ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-muted/50">
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {formatTenantPaymentMethodSummary(defaultPaymentMethod)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTenantPaymentMethodExpiryLine(defaultPaymentMethod)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No payment method on file.<br />Add one during checkout.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workspace Info Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Workspace</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Workspace ID</dt>
                  <dd className="truncate rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{tenant.slug}</dd>
                </div>
                {tenant.stripeCustomerId && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Stripe Customer</dt>
                    <dd className="truncate rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground max-w-[140px]">
                      {tenant.stripeCustomerId}
                    </dd>
                  </div>
                )}
                {tenant.stripeSubscriptionId && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Subscription</dt>
                    <dd className="truncate rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground max-w-[140px]">
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
