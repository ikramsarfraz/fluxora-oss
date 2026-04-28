import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/components/subscription/subscription-badges";
import {
  formatSubscriptionCurrentPeriodLine,
  formatSubscriptionTrialLine,
} from "@/lib/subscription-display";
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
}) {
  const hasStripeId = Boolean(props.stripeCustomerId || props.stripeSubscriptionId);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SubscriptionPlanBadge plan={props.subscriptionPlan} />
        <SubscriptionStatusBadge status={props.subscriptionStatus} />
      </div>
      <dl className="grid max-w-xl gap-3 border-t border-border pt-4 sm:grid-cols-[auto_1fr] sm:gap-x-8 sm:gap-y-3">
        <dt className="text-muted-foreground">Trial</dt>
        <dd className="font-medium text-foreground">
          {formatSubscriptionTrialLine(props.subscriptionStatus, props.trialEndsAt)}
        </dd>
        <dt className="text-muted-foreground">Current billing period ends</dt>
        <dd className="font-medium tabular-nums text-foreground">
          {formatSubscriptionCurrentPeriodLine(props.currentPeriodEndsAt)}
        </dd>
      </dl>
      {hasStripeId ? (
        <div className="space-y-1.5 border-t border-border pt-4 font-mono text-[0.7rem] text-muted-foreground">
          {props.stripeCustomerId ? (
            <p>
              <span className="text-muted-foreground">Stripe customer:</span> {props.stripeCustomerId}
            </p>
          ) : null}
          {props.stripeSubscriptionId ? (
            <p>
              <span className="text-muted-foreground">Stripe subscription:</span>{" "}
              {props.stripeSubscriptionId}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
