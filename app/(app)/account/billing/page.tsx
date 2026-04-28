import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountBillingReturnBanner } from "@/components/account/account-billing-return-banner";
import { TenantBillingCatalogSection } from "@/components/account/tenant-billing-catalog";
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
import { getCurrentTenant } from "@/services/tenants";
import { listActivePaidPlansForBillingPage } from "@/services/stripe-catalog";

export default async function AccountBillingPage(props: {
  searchParams: Promise<{ session_id?: string }>;
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
  const catalogPlans = await listActivePaidPlansForBillingPage();

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
        {params.session_id ? (
          <AccountBillingReturnBanner sessionId={params.session_id} />
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
            />
          </CardContent>
        </Card>
        <Card>
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
