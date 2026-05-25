import {
  formatSubscriptionPlanLabel,
  formatSubscriptionStatusLabel,
} from "@/lib/subscription-display";

type StatusBuckets = {
  trialing: number;
  active: number;
  past_due: number;
  canceled: number;
  comped: number;
};

type PlanBuckets = {
  free: number;
  starter: number;
  growth: number;
  enterprise: number;
};

const STATUS_ORDER = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "comped",
] as const;

const PLAN_ORDER = ["free", "starter", "growth", "enterprise"] as const;

export function PlatformSubscriptionBuckets(props: {
  totalTenants: number;
  subscriptionByStatus: StatusBuckets;
  subscriptionByPlan: PlanBuckets;
}) {
  const statusSum = STATUS_ORDER.reduce(
    (acc, k) => acc + props.subscriptionByStatus[k],
    0,
  );
  const planSum = PLAN_ORDER.reduce((acc, k) => acc + props.subscriptionByPlan[k], 0);

  const matchesTotal =
    statusSum === props.totalTenants &&
    planSum === props.totalTenants &&
    statusSum === planSum;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border bg-surface p-4 text-sm dark:bg-ink-warm/40">
        <p className="font-medium text-ink dark:text-card-warm">By status</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {STATUS_ORDER.map(key => (
            <li key={key}>
              {formatSubscriptionStatusLabel(key)}: {props.subscriptionByStatus[key]}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border bg-surface p-4 text-sm dark:bg-ink-warm/40">
        <p className="font-medium text-ink dark:text-card-warm">By plan</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {PLAN_ORDER.map(key => (
            <li key={key}>
              {formatSubscriptionPlanLabel(key)}: {props.subscriptionByPlan[key]}
            </li>
          ))}
        </ul>
      </div>
      <p
        className={`md:col-span-2 text-xs ${matchesTotal ? "text-muted-foreground" : "text-destructive"}`}
      >
        {matchesTotal ? (
          <>
            Tenant rows partition cleanly:{" "}
            <span className="font-medium text-foreground">
              {props.totalTenants}
            </span>{" "}
            total · status buckets sum to {statusSum} · plan buckets sum to {planSum}.
          </>
        ) : (
          <>
            Count mismatch across tenant buckets (expected each sum to{" "}
            <span className="font-medium">{props.totalTenants}</span>): status totals {statusSum},
            plan totals {planSum}. Investigate duplicated or missing tenants in stored subscription
            fields.
          </>
        )}
      </p>
    </div>
  );
}
