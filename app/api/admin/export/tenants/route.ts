import { NextResponse } from "next/server";

import { serializeCsv } from "@/lib/csv/serialize";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import {
  TENANT_SUBSCRIPTION_PLAN_VALUES,
  TENANT_SUBSCRIPTION_STATUS_VALUES,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import {
  listPlatformAdminTenants,
  type PlatformAdminTenantFilters,
} from "@/modules/core/platform-admin/services/platform-admin";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import { PLATFORM_TENANTS_ROLES } from "@/modules/core/platform-admin/tenants/permissions";

// Cap the export so a runaway click can't pull millions of rows into
// memory. 10k tenants is well past what the current scale needs and
// keeps the response under a few MB; bump when the platform actually
// approaches the limit.
const EXPORT_ROW_CAP = 10_000;

const HEADERS = [
  { key: "id" as const, label: "Tenant ID" },
  { key: "name" as const, label: "Name" },
  { key: "slug" as const, label: "Slug" },
  { key: "tenantType" as const, label: "Tenant type" },
  { key: "isActive" as const, label: "Active" },
  { key: "subscriptionPlan" as const, label: "Plan" },
  { key: "subscriptionStatus" as const, label: "Subscription status" },
  { key: "userCount" as const, label: "Users" },
  { key: "createdAt" as const, label: "Created (UTC)" },
];

function readString(value: string | null): string {
  return value?.trim() ?? "";
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

function authErrorToStatus(message: string): number {
  if (message === "Unauthorized") return 401;
  if (message.toLowerCase().startsWith("forbidden")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requirePlatformUserInRoles(PLATFORM_TENANTS_ROLES);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { detail: message, code: "FORBIDDEN" },
      { status: authErrorToStatus(message) },
    );
  }

  const url = new URL(request.url);
  const filters: PlatformAdminTenantFilters = {
    search: readString(url.searchParams.get("q")) || null,
    isActive: isActiveFilter(readString(url.searchParams.get("active"))),
    subscriptionPlan: planFilter(readString(url.searchParams.get("plan"))),
    subscriptionStatus: statusFilter(readString(url.searchParams.get("status"))),
  };

  recordActionBreadcrumb({
    action: "platform_admin.export_tenants_csv",
    data: {
      hasSearch: Boolean(filters.search),
      activeFilter: filters.isActive ?? "any",
      plan: filters.subscriptionPlan ?? "any",
      status: filters.subscriptionStatus ?? "any",
    },
  });

  const rows = await listPlatformAdminTenants({
    filters,
    limit: EXPORT_ROW_CAP,
  });

  const csvRows = rows.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    tenantType: t.tenantType,
    isActive: t.isActive ? "true" : "false",
    subscriptionPlan: t.subscriptionPlan,
    subscriptionStatus: t.subscriptionStatus,
    userCount: String(t.userCount),
    createdAt: t.createdAt.toISOString(),
  }));

  const body = serializeCsv(HEADERS, csvRows);
  const filename = `fluxora-tenants-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // Block the export from being cached by browsers / proxies — the
      // result depends on the live tenant table.
      "cache-control": "no-store",
      // Surface the row count so the caller can detect a hit on the cap.
      "x-export-row-count": String(csvRows.length),
      "x-export-row-cap": String(EXPORT_ROW_CAP),
    },
  });
}
