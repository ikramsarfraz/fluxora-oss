import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  formatTenantSubscriptionHealthLabel,
  getTenantSubscriptionHealth,
  type TenantSubscriptionHealthInput,
  isTrialEndingWithinDays,
} from "@/lib/tenant-subscription-health";
import { formatSubscriptionTrialLine } from "@/lib/subscription-display";

/** Concise explanatory copy for the Billing page (never blocks Checkout or Manage billing controls). */
export function TenantBillingHealthNotice(props: {
  tenant: TenantSubscriptionHealthInput & {
    stripeCustomerId: string | null;
  };
  canManageBilling: boolean;
}) {
  const health = getTenantSubscriptionHealth(props.tenant);
  const stripeCustomerPresent = !!props.tenant.stripeCustomerId?.trim();

  const trialSoon =
    props.tenant.subscriptionStatus === "trialing" &&
    isTrialEndingWithinDays(props.tenant);

  const stateLine = ((): string => {
    switch (health) {
      case "good":
        return "Stripe subscription data matches a healthy billing state for your workspace tier.";
      case "past_due": {
        return `Stripe marks this workspace as ${formatTenantSubscriptionHealthLabel(
          "past_due",
        )}. Payment should be corrected before Stripe escalates unpaid invoices.`;
      }
      case "canceled":
        return "The Stripe subscription tied to this workspace is canceled. You can subscribe again via Checkout.";
      case "expired":
        return "Trial or billed period timestamps look past due—confirm in Stripe Billing or Dashboard if checkout just ran.";
      case "free":
        return "This workspace has no paid plan on record. Owners and admins can pick a subscribed tier below.";
      case "trialing":
        return trialSoon
          ? "Your Stripe trial ends soon."
          : "You are currently in or near a Stripe-hosted trial.";
    }
  })();

  return (
    <Alert>
      <AlertTitle className="text-foreground">Current billing state</AlertTitle>
      <AlertDescription className="space-y-2 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        <p>{stateLine}</p>
        {health === "trialing" &&
        props.tenant.subscriptionStatus === "trialing" &&
        props.tenant.trialEndsAt != null ? (
          <p className="text-sm">
            {formatSubscriptionTrialLine("trialing", props.tenant.trialEndsAt)}
          </p>
        ) : null}

        {!props.canManageBilling ? (
          <p className="text-xs">
            Billing changes require an owner or admin. Anyone can view this overview.
          </p>
        ) : stripeCustomerPresent ? (
          <p className="text-xs">
            Prefer{" "}
            <strong className="text-foreground">Manage billing</strong> below to open Stripe Customer
            Portal (payment methods, invoices, cancellations). Checkout below is fastest for switching
            or starting a subscribed plan price.
          </p>
        ) : (
          <p className="text-xs">
            <strong className="text-foreground">Manage billing</strong> appears after Stripe Checkout
            (or webhook sync) stores a Stripe customer ID. Until then use the Checkout options below
            —they stay the primary control for starting a subscription.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
