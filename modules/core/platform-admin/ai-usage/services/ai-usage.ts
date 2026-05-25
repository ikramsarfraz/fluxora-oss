import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiUsageEvents, tenants } from "@/db/schema";

// ---------------------------------------------------------------------------
// Platform-admin read-side for AI usage events.
//
// Cannot import from `modules/distribution/**` per module boundary rules,
// so this file queries `ai_usage_events` directly via Drizzle. The writer
// lives in `modules/distribution/supplier-invoices/services/ai-usage-events.ts`.
// ---------------------------------------------------------------------------

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
export async function listTenantUsageAggregates(args: {
  /** Inclusive lower bound on `created_at`. */
  since: Date;
}): Promise<TenantUsageAggregate[]> {
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
    .where(gte(aiUsageEvents.createdAt, args.since))
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
 * Most-recent N events for one tenant. Used when an admin clicks into a
 * tenant from the aggregate list to investigate a cost spike — usually
 * sorted newest-first so the most recent invoice is on top.
 */
export async function listTenantUsageEvents(args: {
  tenantId: string;
  since: Date;
  limit?: number;
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
        gte(aiUsageEvents.createdAt, args.since),
      ),
    )
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(args.limit ?? 200);

  return rows;
}
