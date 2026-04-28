import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformAdminDashboardData } from "@/services/platform-admin";

export default async function PlatformAdminSubscriptionsPage() {
  const data = await getPlatformAdminDashboardData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>{data.subscriptionMetrics.note}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-900">By status</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Trialing: {data.subscriptionByStatus.trialing}</li>
            <li>Active: {data.subscriptionByStatus.active}</li>
            <li>Past due: {data.subscriptionByStatus.past_due}</li>
            <li>Canceled: {data.subscriptionByStatus.canceled}</li>
            <li>Comped: {data.subscriptionByStatus.comped}</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-900">By plan</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Free: {data.subscriptionByPlan.free}</li>
            <li>Starter: {data.subscriptionByPlan.starter}</li>
            <li>Growth: {data.subscriptionByPlan.growth}</li>
            <li>Enterprise: {data.subscriptionByPlan.enterprise}</li>
          </ul>
        </div>
        <p className="md:col-span-2 text-sm text-muted-foreground">
          Edit a tenant under <span className="font-medium">Admin → Tenants</span> to change plan,
          subscription status, billing period dates, or Stripe ids. Revenue metrics (MRR/ARR) require
          Stripe products, prices, and reporting.
        </p>
      </CardContent>
    </Card>
  );
}
