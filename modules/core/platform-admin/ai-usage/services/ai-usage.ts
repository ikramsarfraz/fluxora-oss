import "server-only";

import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { aiUsageEvents, tenants } from "@/db/schema";

// ---------------------------------------------------------------------------
// Platform-admin read-side for AI usage events.
//
// Cannot import from `modules/distribution/**` per module boundary rules,
// so this file queries `ai_usage_events` directly via Drizzle. The writer
// lives in `modules/distribution/supplier-invoices/services/ai-usage-events.ts`.
// ---------------------------------------------------------------------------

export type AiUsageWindow = {
  /** Inclusive lower bound on `created_at`. */
  since: Date;
  /** Inclusive upper bound on `created_at`. Open-ended (now) when null. */
  until?: Date | null;
  /** Restrict to events with this exact model id. Null = all models. */
  model?: string | null;
};

function buildWindowWhere(window: AiUsageWindow): SQL {
  const conditions: SQL[] = [gte(aiUsageEvents.createdAt, window.since)];
  if (window.until) {
    conditions.push(lte(aiUsageEvents.createdAt, window.until));
  }
  if (window.model) {
    conditions.push(eq(aiUsageEvents.model, window.model));
  }
  return and(...conditions)!;
}

export type TenantUsageAggregate = {
  tenantId: string;
  tenantName: string | null;
  tenantSlug: string | null;
  eventCount: number;
  promptTokens: number;
  completionTokens: number;
  costMicros: number;
  /** Number of events where `escalated_from_model` is non-null. */
  escalationCount: number;
  /** Number of events where `succeeded = false`. */
  failureCount: number;
};

/**
 * Per-tenant aggregate of AI usage events over the given window. Used by
 * `/admin/ai-usage` to render the cost-per-tenant table.
 *
 * Returns one row per tenant that has at least one event in the window.
 * Tenants with zero events don't appear — the admin page can join against
 * the full tenant list separately if it wants to show "no usage" rows.
 */
export async function listTenantUsageAggregates(
  window: AiUsageWindow,
): Promise<TenantUsageAggregate[]> {
  const rows = await db
    .select({
      tenantId: aiUsageEvents.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      eventCount: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${aiUsageEvents.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${aiUsageEvents.completionTokens}), 0)::int`,
      costMicros: sql<string>`coalesce(sum(${aiUsageEvents.costMicros}), 0)::bigint`,
      escalationCount: sql<number>`count(*) filter (where ${aiUsageEvents.escalatedFromModel} is not null)::int`,
      failureCount: sql<number>`count(*) filter (where ${aiUsageEvents.succeeded} = false)::int`,
    })
    .from(aiUsageEvents)
    .leftJoin(tenants, eq(tenants.id, aiUsageEvents.tenantId))
    .where(buildWindowWhere(window))
    .groupBy(aiUsageEvents.tenantId, tenants.name, tenants.slug)
    .orderBy(desc(sql`coalesce(sum(${aiUsageEvents.costMicros}), 0)`));

  // `costMicros` comes back as `bigint`-shaped string from pg — coerce to
  // Number for the JSON-friendly admin payload. Costs in our scale fit
  // comfortably in JS's Number range (max safe ~$9.0M before precision
  // loss); revisit if a tenant pushes past that.
  return rows.map(r => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    eventCount: Number(r.eventCount),
    promptTokens: Number(r.promptTokens),
    completionTokens: Number(r.completionTokens),
    costMicros: Number(r.costMicros),
    escalationCount: Number(r.escalationCount),
    failureCount: Number(r.failureCount),
  }));
}

/**
 * Distinct model ids seen in any usage event. Drives the model filter
 * dropdown on the AI usage page. Not bounded to a tenant or window
 * because we want every model the platform has ever called, including
 * deprecated ones, so admins can investigate historical spend.
 */
export async function listDistinctAiModels(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ model: aiUsageEvents.model })
    .from(aiUsageEvents)
    .orderBy(aiUsageEvents.model);
  return rows.map(r => r.model).filter(Boolean);
}

export type AiUsageEventRow = {
  id: string;
  stage: "invoice_extraction" | "vision_extraction" | "product_matching";
  model: string;
  escalatedFromModel: string | null;
  promptTokens: number;
  completionTokens: number;
  costMicros: number;
  succeeded: boolean;
  errorCode: string | null;
  sourceFilename: string | null;
  createdAt: Date;
};

/**
 * Per-tenant events over a window, paginated for the drilldown page.
 * Newest-first so the most-recent invoice is on top — that's what an
 * admin lands on when chasing a cost spike.
 */
export async function listTenantUsageEvents(args: {
  tenantId: string;
  window: AiUsageWindow;
  limit: number;
  offset: number;
}): Promise<AiUsageEventRow[]> {
  const rows = await db
    .select({
      id: aiUsageEvents.id,
      stage: aiUsageEvents.stage,
      model: aiUsageEvents.model,
      escalatedFromModel: aiUsageEvents.escalatedFromModel,
      promptTokens: aiUsageEvents.promptTokens,
      completionTokens: aiUsageEvents.completionTokens,
      costMicros: aiUsageEvents.costMicros,
      succeeded: aiUsageEvents.succeeded,
      errorCode: aiUsageEvents.errorCode,
      sourceFilename: aiUsageEvents.sourceFilename,
      createdAt: aiUsageEvents.createdAt,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.tenantId, args.tenantId),
        buildWindowWhere(args.window),
      ),
    )
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(args.limit)
    .offset(args.offset);

  return rows;
}

export async function countTenantUsageEvents(args: {
  tenantId: string;
  window: AiUsageWindow;
}): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.tenantId, args.tenantId),
        buildWindowWhere(args.window),
      ),
    );
  return row?.count ?? 0;
}

/**
 * One-row tenant aggregate for the drilldown header. Returns null when
 * the tenant has zero events in the window — callers can still show the
 * tenant name from the tenants table.
 */
export async function getTenantUsageAggregate(args: {
  tenantId: string;
  window: AiUsageWindow;
}): Promise<TenantUsageAggregate | null> {
  const [row] = await db
    .select({
      tenantId: aiUsageEvents.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      eventCount: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${aiUsageEvents.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${aiUsageEvents.completionTokens}), 0)::int`,
      costMicros: sql<string>`coalesce(sum(${aiUsageEvents.costMicros}), 0)::bigint`,
      escalationCount: sql<number>`count(*) filter (where ${aiUsageEvents.escalatedFromModel} is not null)::int`,
      failureCount: sql<number>`count(*) filter (where ${aiUsageEvents.succeeded} = false)::int`,
    })
    .from(aiUsageEvents)
    .leftJoin(tenants, eq(tenants.id, aiUsageEvents.tenantId))
    .where(
      and(
        eq(aiUsageEvents.tenantId, args.tenantId),
        buildWindowWhere(args.window),
      ),
    )
    .groupBy(aiUsageEvents.tenantId, tenants.name, tenants.slug);

  if (!row) return null;
  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantSlug: row.tenantSlug,
    eventCount: Number(row.eventCount),
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    costMicros: Number(row.costMicros),
    escalationCount: Number(row.escalationCount),
    failureCount: Number(row.failureCount),
  };
}
