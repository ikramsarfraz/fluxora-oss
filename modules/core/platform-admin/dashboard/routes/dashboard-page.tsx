import Link from "next/link";

import { PlatformSubscriptionBuckets } from "@/modules/core/platform-admin/components/platform-subscription-buckets";
import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import { getPlatformAdminDashboardData } from "@/modules/core/platform-admin/services/platform-admin";

export default async function PlatformAdminDashboardPage() {
  const data = await getPlatformAdminDashboardData();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-blue-700">Pelzer Solutions internal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Platform dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Cross-tenant visibility for internal admins on the reserved admin host.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total tenants</CardDescription>
            <CardTitle className="text-3xl">{data.totalTenants}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active tenants</CardDescription>
            <CardTitle className="text-3xl">{data.activeTenants}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total portal users</CardDescription>
            <CardTitle className="text-3xl">{data.totalPortalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active subscription status</CardDescription>
            <CardTitle className="text-3xl">
              {data.subscriptionByStatus.active}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Tenants with{" "}
            <code className="rounded bg-muted px-1">subscription_status = active</code>.{" "}
            {data.subscriptionMetrics.note}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent tenants</CardTitle>
            <CardDescription>Newest workspaces created across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTenants.map(tenant => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/tenants/${tenant.id}`} className="hover:underline">
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>{tenant.slug}</TableCell>
                    <TableCell className="capitalize">{tenant.tenantType}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.isActive ? "secondary" : "outline"}>
                        {tenant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SubscriptionPlanBadge plan={tenant.subscriptionPlan} />
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
                    </TableCell>
                    <TableCell>{tenant.userCount}</TableCell>
                    <TableCell>{formatDisplayDate(tenant.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>{data.subscriptionMetrics.note}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <PlatformSubscriptionBuckets
              totalTenants={data.totalTenants}
              subscriptionByStatus={data.subscriptionByStatus}
              subscriptionByPlan={data.subscriptionByPlan}
            />
            <Link
              href="/admin/subscriptions"
              className="inline-flex text-sm font-medium text-blue-700 hover:underline"
            >
              Open subscriptions page
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
