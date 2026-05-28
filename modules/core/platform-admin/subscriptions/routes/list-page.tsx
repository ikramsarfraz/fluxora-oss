import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TENANT_SUBSCRIPTION_PLAN_VALUES,
  TENANT_SUBSCRIPTION_STATUS_VALUES,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import { formatMoney } from "@/lib/utils/currency";
import { PlatformSubscriptionBuckets } from "@/modules/core/platform-admin/components/platform-subscription-buckets";
import { SyncStripeCatalogButton } from "@/modules/core/platform-admin/components/sync-stripe-catalog-button";
import { SubscriptionsByTenantTable } from "@/modules/core/platform-admin/subscriptions/components/subscriptions-by-tenant-table";
import { PLATFORM_SUBSCRIPTIONS_ROLES } from "@/modules/core/platform-admin/subscriptions/permissions";
import { computePlatformAdminSubscriptionRevenue } from "@/modules/core/platform-admin/subscriptions/services/subscription-revenue";
import {
  countPlatformAdminSubscriptions,
  getPlatformAdminDashboardData,
  listPlatformAdminSubscriptions,
} from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

const SUB_PAGE_SIZE = 20;

type SearchParams = {
  subQ?: string;
  subPlan?: string;
  subStatus?: string;
  subPage?: string;
};

function centsToMajor(cents: number): number {
  return cents / 100;
}

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parsePage(raw: string, totalPages: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function planFilter(raw: string): TenantSubscriptionPlan | null {
  return (TENANT_SUBSCRIPTION_PLAN_VALUES as readonly string[]).includes(raw)
    ? (raw as TenantSubscriptionPlan)
    : null;
}

function statusFilter(raw: string): TenantSubscriptionStatus | null {
  return (TENANT_SUBSCRIPTION_STATUS_VALUES as readonly string[]).includes(raw)
    ? (raw as TenantSubscriptionStatus)
    : null;
}

function buildHref(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length === 0) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `/admin/subscriptions?${qs}` : "/admin/subscriptions";
}

export default async function PlatformAdminSubscriptionsListPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePlatformUserInRoles(PLATFORM_SUBSCRIPTIONS_ROLES);

  const params = await props.searchParams;
  const subQ = readString(params.subQ);
  const subPlanRaw = readString(params.subPlan);
  const subStatusRaw = readString(params.subStatus);

  const subFilters = {
    search: subQ || null,
    subscriptionPlan: planFilter(subPlanRaw),
    subscriptionStatus: statusFilter(subStatusRaw),
  };

  const [data, revenue, subTotal] = await Promise.all([
    getPlatformAdminDashboardData(),
    computePlatformAdminSubscriptionRevenue(),
    countPlatformAdminSubscriptions(subFilters),
  ]);

  const subTotalPages = Math.max(1, Math.ceil(subTotal / SUB_PAGE_SIZE));
  const subPage = parsePage(readString(params.subPage), subTotalPages);
  const subOffset = (subPage - 1) * SUB_PAGE_SIZE;

  const subscriptionRows = await listPlatformAdminSubscriptions({
    filters: subFilters,
    limit: SUB_PAGE_SIZE,
    offset: subOffset,
  });

  const totalActiveBillablePlans = revenue.byPlan.reduce(
    (sum, p) => sum + p.activeCount,
    0,
  );

  const subFromCount = subTotal === 0 ? 0 : subOffset + 1;
  const subToCount = Math.min(subOffset + subscriptionRows.length, subTotal);
  const hasSubFilters =
    Boolean(subQ) || Boolean(subPlanRaw) || Boolean(subStatusRaw);

  const subBaseParams = {
    subQ: subQ || null,
    subPlan: subPlanRaw || null,
    subStatus: subStatusRaw || null,
  };

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
          <CardTitle>Subscriptions by tenant</CardTitle>
          <CardDescription>
            Edit plan, status, billing dates, or Stripe ids inline without
            navigating to the tenant detail page. The full audit trail is
            still available under Admin → Tenants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            method="get"
            action="/admin/subscriptions"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label
                htmlFor="sub-q"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="sub-q"
                type="search"
                name="subQ"
                defaultValue={subQ}
                placeholder="Tenant name or slug"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="sub-plan"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Plan
              </label>
              <select
                id="sub-plan"
                name="subPlan"
                defaultValue={subPlanRaw}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
              >
                <option value="">Any</option>
                {TENANT_SUBSCRIPTION_PLAN_VALUES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="sub-status"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Status
              </label>
              <select
                id="sub-status"
                name="subStatus"
                defaultValue={subStatusRaw}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
              >
                <option value="">Any</option>
                {TENANT_SUBSCRIPTION_STATUS_VALUES.map(s => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              {hasSubFilters ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/subscriptions">Clear</Link>
                </Button>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {subTotal === 0
                  ? "No tenants match these filters."
                  : `Showing ${subFromCount.toLocaleString()}–${subToCount.toLocaleString()} of ${subTotal.toLocaleString()}`}
              </span>
            </div>
          </form>

          <SubscriptionsByTenantTable
            rows={subscriptionRows}
            emptyMessage={
              hasSubFilters
                ? "No tenants match these filters."
                : "No tenants yet."
            }
          />

          {subTotalPages > 1 ? (
            <nav
              aria-label="Subscriptions pagination"
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>
                Page {subPage.toLocaleString()} of {subTotalPages.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                {subPage > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildHref({
                        ...subBaseParams,
                        subPage: subPage - 1 === 1 ? null : subPage - 1,
                      })}
                    >
                      ← Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    ← Previous
                  </Button>
                )}
                {subPage < subTotalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildHref({ ...subBaseParams, subPage: subPage + 1 })}
                    >
                      Next →
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next →
                  </Button>
                )}
              </div>
            </nav>
          ) : null}
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
        </CardContent>
      </Card>
    </div>
  );
}
