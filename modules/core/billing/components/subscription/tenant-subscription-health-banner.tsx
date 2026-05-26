import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatSubscriptionTrialLine } from "@/lib/subscription-display";
import {
  formatTenantSubscriptionHealthLabel,
  type TenantSubscriptionHealth,
  type TenantSubscriptionHealthInput,
  isTrialEndingWithinDays,
} from "@/lib/tenant-subscription-health";

export function TenantSubscriptionHealthBanner(props: {
  health: TenantSubscriptionHealth;
  tenantFields: TenantSubscriptionHealthInput;
  canManageBilling: boolean;
}) {
  const { health } = props;
  if (health === "good") {
    return null;
  }

  const billingHref = "/settings/billing/plan-and-usage";

  /** Trial-ending-soon UX (narrow window) replaces generic trialing banner. */
  if (health === "trialing" && !isTrialEndingWithinDays(props.tenantFields)) {
    return null;
  }

  /** Optional upgrade banner is only for admins on the free tier. */
  if (health === "free" && !props.canManageBilling) {
    return null;
  }

  if (health === "trialing") {
    return (
      <Alert className="border-warning-border bg-warning-bg/90 text-foreground dark:border-amber-900/70 dark:bg-warning-fg/40 [&_svg]:text-warning-fg dark:[&_svg]:text-warning-fg">
        <AlertTriangle aria-hidden />
        <AlertTitle className="text-foreground">
          Trial ending soon
        </AlertTitle>
        <AlertDescription className="text-foreground/90 [&_a]:text-foreground">
          {props.tenantFields.subscriptionStatus === "trialing" &&
          props.tenantFields.trialEndsAt != null ? (
            <span>
              Trial window:{" "}
              <span className="font-medium tabular-nums">
                {formatSubscriptionTrialLine(
                  "trialing",
                  props.tenantFields.trialEndsAt,
                )}
              </span>
              . Owners and admins can open{" "}
              <Link href={billingHref} className="font-medium underline">
                Billing
              </Link>{" "}
              to subscribe or verify payment details.
            </span>
          ) : (
            <span>
              Your trial is nearing its end. Use{" "}
              <Link href={billingHref} className="font-medium underline">
                Billing
              </Link>{" "}
              before access may be affected in the future.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (health === "free" && props.canManageBilling) {
    return (
      <Alert>
        <AlertTitle className="text-foreground">
          Subscribe to unlock paid tiers
        </AlertTitle>
        <AlertDescription>
          You are currently on{" "}
          <span className="font-medium">
            {formatTenantSubscriptionHealthLabel("free")}
          </span>
          . View{" "}
          <Link href={`${billingHref}#billing-plans`} className="font-medium underline">
            plans on Billing
          </Link>
          {" — "}Checkout remains the fastest way to add a Stripe subscription when your catalog or
          fallback price IDs are configured.
        </AlertDescription>
      </Alert>
    );
  }

  if (health === "past_due") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Payment issue</AlertTitle>
        <AlertDescription>
          Stripe lists this workspace as{" "}
          <span className="font-semibold">
            {formatTenantSubscriptionHealthLabel("past_due")}
          </span>
          . Update the default payment method or resolve the invoice{" "}
          {props.canManageBilling ? (
            <>
              in{" "}
              <Link href={billingHref} className="font-medium underline">
                Billing
              </Link>{" "}
              (Manage billing opens Stripe when a customer exists) or Stripe directly.
            </>
          ) : (
            <span>(ask an owner or admin to open Billing or Stripe).</span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (health === "canceled") {
    return (
      <Alert className="border-destructive/40 bg-destructive/5">
        <AlertTriangle aria-hidden className="text-destructive" />
        <AlertTitle className="text-foreground">Subscription canceled</AlertTitle>
        <AlertDescription>
          This workspace’s subscription is{" "}
          <span className="font-medium">
            {formatTenantSubscriptionHealthLabel("canceled")}
          </span>
          . You can still use the app; start a new plan from{" "}
          <Link href={billingHref} className="font-medium underline">
            Billing
          </Link>
          {!props.canManageBilling ? (
            <span className="text-muted-foreground"> (owners/admins).</span>
          ) : (
            <span>.</span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (health === "expired") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Trial or billing period lapsed</AlertTitle>
        <AlertDescription>
          The recorded trial or subscription period has ended. Confirm your plan in{" "}
          <Link href={billingHref} className="font-medium underline">
            Billing
          </Link>
          —webhooks may still catch up if Stripe was updated recently.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
