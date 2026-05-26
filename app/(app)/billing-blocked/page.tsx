import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TenantBillingPortalControls } from "@/modules/core/billing/components/account/tenant-billing-portal-controls";
import { TenantBillingCatalogSection } from "@/modules/core/billing/components/account/tenant-billing-catalog";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import {
  getTenantSubscriptionHealth,
  shouldBlockTenantAccess,
} from "@/lib/tenant-subscription-health";
import { getUserByAuthUserId } from "@/modules/shared/services/portal-users";
import { listActivePaidPlansForBillingPage } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";

export default async function BillingBlockedPage() {
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
        <h2 className="text-lg font-medium tracking-tight">Billing access</h2>
        <p className="text-muted-foreground text-sm">
          No portal profile is linked to this sign-in yet.
        </p>
        <Button variant="outline" className="w-fit" asChild>
          <Link href="/settings/account/profile">Back to account</Link>
        </Button>
      </div>
    );
  }

  const tenant = await getCurrentTenantCached();

  const health = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });

  if (!shouldBlockTenantAccess(health)) {
    redirect("/dashboard");
  }

  const catalogPlans = await listActivePaidPlansForBillingPage();

  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";

  const isCanceled = health === "canceled";

  return (
    <div className="@container/main flex flex-1 flex-col gap-6">
      <div className="px-0 pt-2">
        <PageHeader
          title={isCanceled ? "Subscription canceled" : "Subscription inactive"}
          description="This workspace no longer has active billing. Open Billing to subscribe again, update payment methods, or resolve the subscription in Stripe."
        />
      </div>
      <div className="grid max-w-3xl gap-4">
        <Alert variant="destructive">
          <AlertTitle>Access to the app is limited</AlertTitle>
          <AlertDescription className="[&_a]:underline">
            {isCanceled
              ? "Your subscription is canceled—the rest of this app stays locked until Billing is resolved. Account profile and Billing (including Stripe Checkout / Customer Portal) stay available."
              : "The recorded trial or subscription period has lapsed without an active plan. Use Billing to subscribe or confirm payment in Stripe."}
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Restore access</CardTitle>
            <CardDescription>
              Go to the full Billing workspace to use Checkout, or open Stripe Customer Portal when a
              Stripe customer already exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/settings/billing/plan-and-usage">Open Billing</Link>
            </Button>
            {!canManageBilling ? (
              <p className="w-full text-muted-foreground text-xs">
                Owners or admins can subscribe or manage payment details; you can still review this
                overview.
              </p>
            ) : null}
          </CardContent>
        </Card>
        {canManageBilling ? (
          <Card>
            <CardHeader>
              <CardTitle>Stripe Customer Portal</CardTitle>
              <CardDescription>
                Available when Checkout or webhooks have stored a Stripe customer for this
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <TenantBillingPortalControls
                canManageBilling={canManageBilling}
                stripeCustomerId={tenant.stripeCustomerId}
              />
            </CardContent>
          </Card>
        ) : null}
        {canManageBilling ? (
          <Card id="billing-plans-blocked">
            <CardHeader>
              <CardTitle>Choose a plan</CardTitle>
              <CardDescription>
                Same catalog as Billing. Subscribing here also updates access after webhooks sync the
                tenant record.
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
        ) : null}
      </div>
    </div>
  );
}
