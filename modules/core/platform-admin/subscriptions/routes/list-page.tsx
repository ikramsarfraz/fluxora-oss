import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/currency";
import { PlatformSubscriptionBuckets } from "@/modules/core/platform-admin/components/platform-subscription-buckets";
import { SyncStripeCatalogButton } from "@/modules/core/platform-admin/components/sync-stripe-catalog-button";
import { PLATFORM_SUBSCRIPTIONS_ROLES } from "@/modules/core/platform-admin/subscriptions/permissions";
import { computePlatformAdminSubscriptionRevenue } from "@/modules/core/platform-admin/subscriptions/services/subscription-revenue";
import { getPlatformAdminDashboardData } from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

function centsToMajor(cents: number): number {
  return cents / 100;
}

export default async function PlatformAdminSubscriptionsListPage() {
  await requirePlatformUserInRoles(PLATFORM_SUBSCRIPTIONS_ROLES);
  const [data, revenue] = await Promise.all([
    getPlatformAdminDashboardData(),
    computePlatformAdminSubscriptionRevenue(),
  ]);

  const totalActiveBillablePlans = revenue.byPlan.reduce(
    (sum, p) => sum + p.activeCount,
    0,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Revenue</CardTitle>
              <CardDescription>
                Approximate platform MRR + ARR derived from cached Stripe
                prices and currently-active paid subscriptions. Trialing and
                comped tenants are excluded.
              </CardDescription>
            </div>
            <SyncStripeCatalogButton />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-border-default bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                MRR
              </p>
              <p className="mt-1 text-3xl font-medium tabular-nums">
                {formatMoney(
                  centsToMajor(revenue.monthlyRecurringRevenueCents),
                  revenue.currency,
                )}
              </p>
            </div>
            <div className="rounded-md border border-border-default bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ARR
              </p>
              <p className="mt-1 text-3xl font-medium tabular-nums">
                {formatMoney(
                  centsToMajor(revenue.annualRecurringRevenueCents),
                  revenue.currency,
                )}
              </p>
            </div>
            <div className="rounded-md border border-border-default bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paying tenants
              </p>
              <p className="mt-1 text-3xl font-medium tabular-nums">
                {totalActiveBillablePlans.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active paid plans only (excludes trialing and comped).
              </p>
            </div>
          </div>

          {revenue.warnings.length > 0 ? (
            <Alert variant="default" className="border-amber-500/40 bg-warning-bg/70 dark:bg-warning-fg/35 dark:border-amber-800/50">
              <AlertTitle>Revenue is approximate</AlertTitle>
              <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
                <ul className="ml-4 list-disc space-y-1">
                  {revenue.warnings.map(w => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Active tenants</TableHead>
                <TableHead className="text-right">Monthly price</TableHead>
                <TableHead className="text-right">MRR contribution</TableHead>
                <TableHead>Basis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenue.byPlan.map(row => (
                <TableRow key={row.plan}>
                  <TableCell className="font-medium capitalize">
                    {row.plan}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.monthlyUnitAmountCents != null
                      ? formatMoney(
                          centsToMajor(row.monthlyUnitAmountCents),
                          row.currency ?? revenue.currency,
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(
                      centsToMajor(row.monthlyRevenueCents),
                      row.currency ?? revenue.currency,
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.basisInterval === "month"
                      ? "Monthly price"
                      : row.basisInterval === "year"
                        ? "Annual price ÷ 12"
                        : "No active price"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions snapshot</CardTitle>
          <CardDescription>{data.subscriptionMetrics.note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <PlatformSubscriptionBuckets
            totalTenants={data.totalTenants}
            subscriptionByStatus={data.subscriptionByStatus}
            subscriptionByPlan={data.subscriptionByPlan}
          />
          <p className="text-muted-foreground">
            Use{" "}
            <span className="font-medium">Sync Stripe catalog</span> after
            changing Products or Prices (or metadata{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              plan=starter|growth|enterprise
            </code>
            ); errors surface in toasts after the request finishes.
          </p>
          <p className="text-muted-foreground">
            Edit a tenant under{" "}
            <span className="font-medium">Admin → Tenants</span> to change plan,
            subscription status, billing period dates, or Stripe ids.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
