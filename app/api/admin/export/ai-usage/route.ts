import { NextResponse } from "next/server";

import { formatAiUsageCost } from "@/lib/ai-cost";
import { serializeCsv } from "@/lib/csv/serialize";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import {
  listDistinctAiModels,
  listTenantUsageAggregates,
} from "@/modules/core/platform-admin/ai-usage/services/ai-usage";
import { PLATFORM_AI_USAGE_ROLES } from "@/modules/core/platform-admin/ai-usage/permissions";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

// Per-tenant aggregate row count is bounded by tenant count (~ low
// hundreds at platform scale), so a cap mostly exists as a defensive
// ceiling — bumping is cheap.
const EXPORT_ROW_CAP = 10_000;

const HEADERS = [
  { key: "tenantId" as const, label: "Tenant ID" },
  { key: "tenantName" as const, label: "Tenant" },
  { key: "tenantSlug" as const, label: "Slug" },
  { key: "eventCount" as const, label: "Calls" },
  { key: "promptTokens" as const, label: "Prompt tokens" },
  { key: "completionTokens" as const, label: "Completion tokens" },
  { key: "escalationCount" as const, label: "Escalations" },
  { key: "failureCount" as const, label: "Failures" },
  { key: "costMicros" as const, label: "Cost (micro-USD)" },
  { key: "costDisplay" as const, label: "Cost (USD)" },
];

function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function parseDateInputAsUtc(raw: string | null): Date | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function authErrorToStatus(message: string): number {
  if (message === "Unauthorized") return 401;
  if (message.toLowerCase().startsWith("forbidden")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requirePlatformUserInRoles(PLATFORM_AI_USAGE_ROLES);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { detail: message, code: "FORBIDDEN" },
      { status: authErrorToStatus(message) },
    );
  }

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const untilRaw = url.searchParams.get("until");
  const modelRaw = (url.searchParams.get("model") ?? "").trim();

  const since = parseDateInputAsUtc(sinceRaw) ?? startOfMonthUtc();
  const untilDate = parseDateInputAsUtc(untilRaw);
  const until = untilDate
    ? new Date(untilDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  // Validate the model param against the known catalog so an arbitrary
  // string can't reach the query. Skipping the catalog lookup when
  // there's no filter to keep cold-path latency tight.
  let model: string | null = null;
  if (modelRaw) {
    const knownModels = await listDistinctAiModels();
    model = knownModels.includes(modelRaw) ? modelRaw : null;
  }

  recordActionBreadcrumb({
    action: "platform_admin.export_ai_usage_csv",
    data: {
      hasSince: Boolean(sinceRaw),
      hasUntil: Boolean(untilRaw),
      model: model ?? "any",
    },
  });

  const rows = await listTenantUsageAggregates({ since, until, model });
  const capped = rows.slice(0, EXPORT_ROW_CAP);

  const csvRows = capped.map(r => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName ?? "",
    tenantSlug: r.tenantSlug ?? "",
    eventCount: String(r.eventCount),
    promptTokens: String(r.promptTokens),
    completionTokens: String(r.completionTokens),
    escalationCount: String(r.escalationCount),
    failureCount: String(r.failureCount),
    costMicros: String(r.costMicros),
    costDisplay: formatAiUsageCost(r.costMicros),
  }));

  const body = serializeCsv(HEADERS, csvRows);
  const filename = `fluxora-ai-usage-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-export-row-count": String(csvRows.length),
      "x-export-row-cap": String(EXPORT_ROW_CAP),
    },
  });
}
