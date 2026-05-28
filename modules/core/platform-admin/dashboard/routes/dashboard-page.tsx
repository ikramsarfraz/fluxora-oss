import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { PlatformSubscriptionBuckets } from "@/modules/core/platform-admin/components/platform-subscription-buckets";
import { PLATFORM_DASHBOARD_ROLES } from "@/modules/core/platform-admin/dashboard/permissions";
import { computeDelta } from "@/modules/core/platform-admin/dashboard/utils/compute-delta";
import { getPlatformAdminDashboardData } from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

type SearchParams = {
  since?: string;
  until?: string;
};

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parseDateInputAsUtc(raw: string): Date | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultSince(now: Date = new Date()): Date {
  // Rolling 30-day window — same scale as a "this month" view but
  // independent of calendar month boundaries.
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

function formatPriorWindow(priorWindow: { since: Date; until: Date }): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(priorWindow.since)} – ${fmt(priorWindow.until)}`;
}

function DashboardDelta({
  current,
  prior,
  priorWindow,
}: {
  current: number;
  prior: number;
  priorWindow: { since: Date; until: Date };
}) {
  const { diff, direction, pct } = computeDelta({ current, prior });
  const label = formatPriorWindow(priorWindow);

  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  const tone =
    direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : direction === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm", tone)}
      title={`vs ${label} (${prior})`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular-nums">
        {direction === "flat" ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
      </span>
      {pct != null ? (
        <span className="text-xs text-muted-foreground">
          ({pct > 0 ? "+" : ""}
          {pct}%)
        </span>
      ) : null}
    </span>
  );
}

export default async function PlatformAdminDashboardPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePlatformUserInRoles(PLATFORM_DASHBOARD_ROLES);
  const params = await props.searchParams;
  const sinceRaw = readString(params.since);
  const untilRaw = readString(params.until);

  const since = parseDateInputAsUtc(sinceRaw) ?? defaultSince();
  const untilDate = parseDateInputAsUtc(untilRaw);
  const until = untilDate
    ? new Date(untilDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  const data = await getPlatformAdminDashboardData({ since, until });

  const windowLabel = until
    ? `${since.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : sinceRaw
      ? `Since ${since.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : "Last 30 days";
  const hasFilters = Boolean(sinceRaw) || Boolean(untilRaw);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-forest">Pelzer Solutions internal</p>
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          Platform dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Cross-tenant visibility for internal admins on the reserved admin host.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Window</CardTitle>
          <CardDescription>
            Inclusive on both ends. Drives the &ldquo;new in window&rdquo; cards
            below; the snapshot totals stay absolute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/admin"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="dashboard-since"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Since
              </label>
              <Input
                id="dashboard-since"
                type="date"
                name="since"
                defaultValue={sinceRaw || toDateInputValue(defaultSince())}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="dashboard-until"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Until
              </label>
              <Input
                id="dashboard-until"
                type="date"
                name="until"
                defaultValue={untilRaw}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              {hasFilters ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin">Reset</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

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

      {data.window ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>New tenants · {windowLabel}</CardDescription>
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-3xl tabular-nums">
                  {data.window.newTenants}
                </CardTitle>
                <DashboardDelta
                  current={data.window.newTenants}
                  prior={data.window.priorNewTenants}
                  priorWindow={data.window.priorWindow}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Tenants whose <code className="font-mono">created_at</code> falls
              inside the selected window. Delta compares to the prior
              equal-length period.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>New portal users · {windowLabel}</CardDescription>
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-3xl tabular-nums">
                  {data.window.newPortalUsers}
                </CardTitle>
                <DashboardDelta
                  current={data.window.newPortalUsers}
                  prior={data.window.priorNewPortalUsers}
                  priorWindow={data.window.priorWindow}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Portal users created inside the selected window, across every
              tenant. Delta compares to the prior equal-length period.
            </CardContent>
          </Card>
        </div>
      ) : null}

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
              className="inline-flex text-sm font-medium text-forest hover:underline"
            >
              Open subscriptions page
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
