import Link from "next/link";

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
  TENANT_SUBSCRIPTION_PLAN_VALUES,
  TENANT_SUBSCRIPTION_STATUS_VALUES,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import { TenantsListClient } from "@/modules/core/platform-admin/tenants/components/tenants-list-client";
import {
  PLATFORM_TENANTS_EDIT_ROLES,
  PLATFORM_TENANTS_ROLES,
} from "@/modules/core/platform-admin/tenants/permissions";
import {
  countPlatformAdminTenants,
  listPlatformAdminTenants,
  type PlatformAdminTenantFilters,
} from "@/modules/core/platform-admin/services/platform-admin";
import {
  hasPlatformUserRole,
  requirePlatformUserInRoles,
} from "@/modules/core/platform-admin/services/platform-users";

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  active?: string;
  plan?: string;
  status?: string;
  page?: string;
};

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parsePage(raw: string | undefined, totalPages: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function isActiveFilter(raw: string): "active" | "inactive" | null {
  return raw === "active" || raw === "inactive" ? raw : null;
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
  return qs ? `/admin/tenants?${qs}` : "/admin/tenants";
}

export default async function PlatformAdminTenantsListPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requirePlatformUserInRoles(PLATFORM_TENANTS_ROLES);
  const canEdit = hasPlatformUserRole(currentUser, PLATFORM_TENANTS_EDIT_ROLES);
  const params = await props.searchParams;
  const q = readString(params.q);
  const activeRaw = readString(params.active);
  const planRaw = readString(params.plan);
  const statusRaw = readString(params.status);

  const filters: PlatformAdminTenantFilters = {
    search: q || null,
    isActive: isActiveFilter(activeRaw),
    subscriptionPlan: planFilter(planRaw),
    subscriptionStatus: statusFilter(statusRaw),
  };

  const total = await countPlatformAdminTenants(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(params.page, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const tenants = await listPlatformAdminTenants({
    filters,
    limit: PAGE_SIZE,
    offset,
  });

  const hasFilters =
    Boolean(q) || Boolean(activeRaw) || Boolean(planRaw) || Boolean(statusRaw);
  const fromCount = total === 0 ? 0 : offset + 1;
  const toCount = Math.min(offset + tenants.length, total);

  const baseParams = {
    q: q || null,
    active: activeRaw || null,
    plan: planRaw || null,
    status: statusRaw || null,
  };

  const exportHref = (() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (!v) continue;
      sp.set(k, v);
    }
    const qs = sp.toString();
    return qs
      ? `/api/admin/export/tenants?${qs}`
      : "/api/admin/export/tenants";
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenants</CardTitle>
        <CardDescription>
          Internal view across all tenant workspaces. The `admin` slug is reserved and cannot be
          used by customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          method="get"
          action="/admin/tenants"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label
              htmlFor="tenants-q"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Search
            </label>
            <Input
              id="tenants-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name or slug"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="tenants-active"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Status
            </label>
            <select
              id="tenants-active"
              name="active"
              defaultValue={activeRaw}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
            >
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="tenants-plan"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Plan
            </label>
            <select
              id="tenants-plan"
              name="plan"
              defaultValue={planRaw}
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
              htmlFor="tenants-status"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Subscription
            </label>
            <select
              id="tenants-status"
              name="status"
              defaultValue={statusRaw}
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
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            {hasFilters ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/tenants">Clear</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              {/* Plain anchor, not <Link>, so the browser handles the
                  download response rather than Next.js routing it. */}
              <a href={exportHref} download>
                Export CSV
              </a>
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {total === 0
                ? "No tenants match these filters."
                : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>
        </form>

        <TenantsListClient
          rows={tenants}
          canEdit={canEdit}
          emptyMessage={
            hasFilters
              ? "No tenants match these filters."
              : "No tenants yet."
          }
        />

        {totalPages > 1 ? (
          <nav
            aria-label="Tenants pagination"
            className="flex items-center justify-between text-sm text-muted-foreground"
          >
            <span>
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildHref({
                      ...baseParams,
                      page: page - 1 === 1 ? null : page - 1,
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
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref({ ...baseParams, page: page + 1 })}>
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
  );
}
