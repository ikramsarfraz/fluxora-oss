import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatSubscriptionPlanLabel,
} from "@/lib/subscription-display";
import {
  formatUsageLimit,
  getUsageState,
  type SubscriptionUsageMetric,
} from "@/lib/subscription-usage-metrics";
import type { TenantPlanUsage } from "@/modules/core/billing/services/subscription-usage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function UsageMetricCard(props: {
  label: string;
  metric: SubscriptionUsageMetric;
  showUpgradeCta: boolean;
}) {
  const state = getUsageState(props.metric);
  const showBadge = state !== "normal";
  const showUpgradeLink = props.showUpgradeCta && showBadge;

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <dt className="text-muted-foreground">{props.label}</dt>
        {showBadge ? (
          <Badge variant={state === "at_limit" ? "destructive" : "outline"}>
            {state === "at_limit" ? "At limit" : "Near limit"}
          </Badge>
        ) : null}
      </div>
      <dd className="mt-1 font-medium text-foreground">
        {props.metric.current} / {formatUsageLimit(props.metric.limit)}
      </dd>
      {showUpgradeLink ? (
        <div className="mt-2">
          <Link
            href="/settings/billing/plan-and-usage#billing-plans"
            className="text-sm font-medium underline underline-offset-4"
          >
            Upgrade plan
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function TenantPlanUsageCard(props: {
  usage: TenantPlanUsage;
  showUpgradeCta?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan usage</CardTitle>
        <CardDescription>
          Current usage for the {formatSubscriptionPlanLabel(props.usage.currentPlan)} plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <UsageMetricCard
            label="Portal users"
            metric={props.usage.portalUsers}
            showUpgradeCta={props.showUpgradeCta ?? false}
          />
          <UsageMetricCard
            label="Products"
            metric={props.usage.products}
            showUpgradeCta={props.showUpgradeCta ?? false}
          />
          <UsageMetricCard
            label="Customers"
            metric={props.usage.customers}
            showUpgradeCta={props.showUpgradeCta ?? false}
          />
          <UsageMetricCard
            label="Monthly orders"
            metric={props.usage.monthlyOrders}
            showUpgradeCta={props.showUpgradeCta ?? false}
          />
        </dl>
      </CardContent>
    </Card>
  );
}
