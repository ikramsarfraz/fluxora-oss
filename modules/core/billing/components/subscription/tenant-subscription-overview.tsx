import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  formatSubscriptionCurrentPeriodLine,
  formatSubscriptionPlanLabel,
  formatSubscriptionStatusLabel,
  formatSubscriptionTrialLine,
  formatTenantPaymentMethodExpiryLine,
  formatTenantPaymentMethodSummary,
} from "@/lib/subscription-display";
import type { TenantDefaultPaymentMethod } from "@/lib/stripe/tenant-default-payment-method";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";

export function TenantSubscriptionOverview(props: {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | string | null | undefined;
  currentPeriodEndsAt: Date | string | null | undefined;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  /** Server-fetched default (or first saved) card — null when none or unavailable. */
  defaultPaymentMethod: TenantDefaultPaymentMethod | null;
  /** Optional Stripe webhook / sync explanation beneath the snapshot. */
  observabilityNote?: string | null;
}) {
  const planTitle = formatSubscriptionPlanLabel(props.subscriptionPlan);
  const statusTitle = formatSubscriptionStatusLabel(props.subscriptionStatus);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SubscriptionPlanBadge plan={props.subscriptionPlan} />
        <SubscriptionStatusBadge status={props.subscriptionStatus} />
      </div>

      <dl className="grid max-w-xl gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-x-8 sm:gap-y-3">
        <dt className="text-muted-foreground">Current plan</dt>
        <dd className="font-medium tabular-nums text-foreground">{planTitle}</dd>
        <dt className="text-muted-foreground">Subscription status</dt>
        <dd className="font-medium text-foreground">{statusTitle}</dd>
        <dt className="text-muted-foreground">Trial</dt>
        <dd className="font-medium text-foreground">
          {formatSubscriptionTrialLine(props.subscriptionStatus, props.trialEndsAt)}
        </dd>
        <dt className="text-muted-foreground">Current period ends</dt>
        <dd className="font-medium tabular-nums text-foreground">
          {formatSubscriptionCurrentPeriodLine(props.currentPeriodEndsAt)}
        </dd>
      </dl>

      {props.observabilityNote ? (
        <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground text-xs leading-relaxed">
          {props.observabilityNote}
        </p>
      ) : null}

      <div className="mt-2 border-t border-border pt-4">
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          Stripe linkage
        </p>
        <div className="space-y-1.5 font-mono text-[0.7rem] text-muted-foreground">
          <p>
            <span className="font-sans text-muted-foreground">Customer ID:</span>{" "}
            <span className="tabular-nums text-foreground">
              {props.stripeCustomerId?.trim() || "—"}
            </span>
          </p>
          <p>
            <span className="font-sans text-muted-foreground">Subscription ID:</span>{" "}
            <span className="tabular-nums text-foreground">
              {props.stripeSubscriptionId?.trim() || "—"}
            </span>
          </p>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            Payment method
          </p>
          {props.defaultPaymentMethod ? (
            <div className="space-y-1 text-foreground">
              <p className="font-medium">
                {formatTenantPaymentMethodSummary(props.defaultPaymentMethod)}
              </p>
              <p className="text-muted-foreground tabular-nums">
                {formatTenantPaymentMethodExpiryLine(props.defaultPaymentMethod)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No card on file in Stripe wallet for this customer</p>
          )}
        </div>
      </div>
    </div>
  );
}
