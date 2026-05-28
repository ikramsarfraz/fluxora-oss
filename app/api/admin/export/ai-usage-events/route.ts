import { NextResponse } from "next/server";

import { formatAiUsageCost } from "@/lib/ai-cost";
import { serializeCsv } from "@/lib/csv/serialize";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import { isUuid } from "@/lib/utils/uuid";
import {
  listDistinctAiModels,
  listTenantUsageEvents,
} from "@/modules/core/platform-admin/ai-usage/services/ai-usage";
import { PLATFORM_AI_USAGE_ROLES } from "@/modules/core/platform-admin/ai-usage/permissions";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

// Events are per-call rows so volume can grow fast on busy tenants;
// keep the cap conservative. Bumping is cheap when needed.
const EXPORT_ROW_CAP = 10_000;

const HEADERS = [
  { key: "id" as const, label: "Event ID" },
  { key: "createdAt" as const, label: "When (UTC)" },
  { key: "stage" as const, label: "Stage" },
  { key: "model" as const, label: "Model" },
  { key: "escalatedFromModel" as const, label: "Escalated from" },
  { key: "promptTokens" as const, label: "Prompt tokens" },
  { key: "completionTokens" as const, label: "Completion tokens" },
  { key: "costMicros" as const, label: "Cost (micro-USD)" },
  { key: "costDisplay" as const, label: "Cost (USD)" },
  { key: "succeeded" as const, label: "Succeeded" },
  { key: "errorCode" as const, label: "Error code" },
  { key: "sourceFilename" as const, label: "Source filename" },
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
  const tenantId = (url.searchParams.get("tenantId") ?? "").trim();
  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json(
      { detail: "Missing or invalid tenantId", code: "REJECTED" },
      { status: 400 },
    );
  }

  const sinceRaw = url.searchParams.get("since");
  const untilRaw = url.searchParams.get("until");
  const modelRaw = (url.searchParams.get("model") ?? "").trim();

  const since = parseDateInputAsUtc(sinceRaw) ?? startOfMonthUtc();
  const untilDate = parseDateInputAsUtc(untilRaw);
  const until = untilDate
    ? new Date(untilDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  let model: string | null = null;
  if (modelRaw) {
    const knownModels = await listDistinctAiModels();
    model = knownModels.includes(modelRaw) ? modelRaw : null;
  }

  recordActionBreadcrumb({
    action: "platform_admin.export_ai_usage_events_csv",
    data: {
      tenantId,
      hasSince: Boolean(sinceRaw),
      hasUntil: Boolean(untilRaw),
      model: model ?? "any",
    },
  });

  const events = await listTenantUsageEvents({
    tenantId,
    window: { since, until, model },
    limit: EXPORT_ROW_CAP,
    offset: 0,
  });

  const csvRows = events.map(e => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    stage: e.stage,
    model: e.model,
    escalatedFromModel: e.escalatedFromModel ?? "",
    promptTokens: String(e.promptTokens),
    completionTokens: String(e.completionTokens),
    costMicros: String(e.costMicros),
    costDisplay: formatAiUsageCost(e.costMicros),
    succeeded: e.succeeded ? "true" : "false",
    errorCode: e.errorCode ?? "",
    sourceFilename: e.sourceFilename ?? "",
  }));

  const body = serializeCsv(HEADERS, csvRows);
  const filename = `fluxora-ai-usage-events-${tenantId.slice(
    0,
    8,
  )}-${new Date().toISOString().slice(0, 10)}.csv`;

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
