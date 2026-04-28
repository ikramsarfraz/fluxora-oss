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
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          Stripe linkage
        </p>
        <div className="space-y-1.5 font-mono text-[0.7rem] text-muted-foreground">
          <p>
            <span className="text-muted-foreground">Customer ID:</span>{" "}
            <span className="tabular-nums text-foreground">
              {props.stripeCustomerId?.trim() || "—"}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Subscription ID:</span>{" "}
            <span className="tabular-nums text-foreground">
              {props.stripeSubscriptionId?.trim() || "—"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
