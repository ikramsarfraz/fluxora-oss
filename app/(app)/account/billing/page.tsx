import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountBillingReturnBanner } from "@/components/account/account-billing-return-banner";
import { TenantBillingCheckoutButtons } from "@/components/account/tenant-billing-checkout-buttons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { formatDisplayDate } from "@/lib/utils/date";
import { getUserByAuthUserId } from "@/services/portal-users";
import { getCurrentTenant } from "@/services/tenants";

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

  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";

  return (
    <div className="@container/main flex flex-1 flex-col gap-6">
      <div className="px-0 pt-2">
        <PageHeader
          title="Billing"
          description="Workspace subscription (Stripe Checkout). Updates sync via webhooks; platform admins may also edit fields manually."
        />
      </div>
      <div className="grid max-w-2xl gap-4">
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
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Plan: </span>
              <span className="font-medium capitalize">
                {tenant.subscriptionPlan}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Status: </span>
              <Badge variant="secondary" className="capitalize">
                {tenant.subscriptionStatus.replaceAll("_", " ")}
              </Badge>
            </p>
            <p>
              <span className="text-muted-foreground">Trial ends: </span>
              {formatDisplayDate(tenant.trialEndsAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Current period ends: </span>
              {formatDisplayDate(tenant.currentPeriodEndsAt)}
            </p>
            {tenant.stripeCustomerId ? (
              <p className="font-mono text-xs text-muted-foreground">
                Stripe customer: {tenant.stripeCustomerId}
              </p>
            ) : null}
            {tenant.stripeSubscriptionId ? (
              <p className="font-mono text-xs text-muted-foreground">
                Stripe subscription: {tenant.stripeSubscriptionId}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upgrade or change plan</CardTitle>
            <CardDescription>
              {canManageBilling
                ? "Use Stripe-hosted Checkout below to subscribe or change plans."
                : "Stripe Checkout may only be started by a workspace owner or admin."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageBilling ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Requires <code className="text-xs">STRIPE_SECRET_KEY</code>{" "}
                  and price IDs in env. After payment completes, Stripe sends{" "}
                  <code className="text-xs">checkout.session.completed</code>{" "}
                  and subscription webhooks — this app updates billing fields and
                  writes an audit log.
                </p>
                <TenantBillingCheckoutButtons />
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Only workspace owners and admins can start a Stripe Checkout session.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
