import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformAdminSubscriptionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>
          Billing integration is intentionally out of scope for v1.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="rounded-xl border bg-slate-50 p-4">
          Placeholder metrics will land here once subscription and billing data is available.
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          Planned follow-ups: plan counts, MRR, ARR, churn, renewal health, and delinquency.
        </div>
      </CardContent>
    </Card>
  );
}
