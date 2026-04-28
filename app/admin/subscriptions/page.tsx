import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformSubscriptionBuckets } from "@/components/platform/platform-subscription-buckets";
import { SyncStripeCatalogButton } from "@/components/platform/sync-stripe-catalog-button";
import { getPlatformAdminDashboardData } from "@/services/platform-admin";

export default async function PlatformAdminSubscriptionsPage() {
  const data = await getPlatformAdminDashboardData();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>{data.subscriptionMetrics.note}</CardDescription>
          </div>
          <SyncStripeCatalogButton />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <PlatformSubscriptionBuckets
          totalTenants={data.totalTenants}
          subscriptionByStatus={data.subscriptionByStatus}
          subscriptionByPlan={data.subscriptionByPlan}
        />
        <p className="text-muted-foreground">
          Use{" "}
          <span className="font-medium">Sync Stripe catalog</span> after changing Products or Prices
          (or metadata{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">plan=starter|growth|enterprise</code>
          ); errors surface in toasts after the request finishes.
        </p>
        <p className="text-muted-foreground">
          Edit a tenant under <span className="font-medium">Admin → Tenants</span> to change plan,
          subscription status, billing period dates, or Stripe ids. Revenue metrics (MRR/ARR) require
          Stripe products, prices, and reporting.
        </p>
      </CardContent>
    </Card>
  );
}
