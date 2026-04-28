import {
  formatSubscriptionPlanLabel,
} from "@/lib/subscription-display";
import type { TenantPlanUsage } from "@/services/subscription-usage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}

export function TenantPlanUsageCard(props: {
  usage: TenantPlanUsage;
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
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <dt className="text-muted-foreground">Portal users</dt>
            <dd className="mt-1 font-medium text-foreground">
              {props.usage.portalUsers.current} / {formatLimit(props.usage.portalUsers.limit)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <dt className="text-muted-foreground">Products</dt>
            <dd className="mt-1 font-medium text-foreground">
              {props.usage.products.current} / {formatLimit(props.usage.products.limit)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <dt className="text-muted-foreground">Customers</dt>
            <dd className="mt-1 font-medium text-foreground">
              {props.usage.customers.current} / {formatLimit(props.usage.customers.limit)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <dt className="text-muted-foreground">Monthly orders</dt>
            <dd className="mt-1 font-medium text-foreground">
              {props.usage.monthlyOrders.current} / {formatLimit(props.usage.monthlyOrders.limit)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
