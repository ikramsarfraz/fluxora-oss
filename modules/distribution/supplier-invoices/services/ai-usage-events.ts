import "server-only";

import { db } from "@/db";
import { aiUsageEvents } from "@/db/schema";

import { calculateAiCostMicros } from "@/lib/ai-cost";

import type { PipelineUsageEvent } from "./parsing-pipeline";

// ---------------------------------------------------------------------------
// AI usage events — WRITER. Called from the action layer after each pipeline
// run, with tenant/user context already in scope. Readers live in
// `modules/core/platform-admin/ai-usage/...` because (a) they're consumed by
// the admin host and (b) `modules/core/**` cannot import from
// `modules/distribution/**` per the boundary rules.
// ---------------------------------------------------------------------------

export type RecordUsageEventsInput = {
  tenantId: string;
  portalUserId: string | null;
  sourceBulkImportFileId: string | null;
  sourceFilename: string | null;
  events: PipelineUsageEvent[];
};

/**
 * Persist the per-stage usage events emitted by a single pipeline run. Best-
 * effort: failures are logged but do NOT propagate — losing a row of cost
 * telemetry should never break the user's invoice review.
 */
export async function recordAiUsageEvents(
  input: RecordUsageEventsInput,
): Promise<void> {
  if (input.events.length === 0) return;

  const rows = input.events.map(event => ({
    tenantId: input.tenantId,
    portalUserId: input.portalUserId,
    stage: event.stage,
    model: event.model,
    escalatedFromModel: event.escalatedFromModel,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    costMicros: calculateAiCostMicros({
      model: event.model,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
    }),
    succeeded: event.succeeded,
    errorCode: event.errorCode,
    sourceBulkImportFileId: input.sourceBulkImportFileId,
    sourceFilename: input.sourceFilename,
  }));

  try {
    await db.insert(aiUsageEvents).values(rows);
  } catch (err) {
    // Don't break the user's parse on a usage-tracking write failure.
    // Worst case: a few events are missing from the admin dashboard —
    // the parse + persistence path is unaffected.
    console.warn("[ai-usage-events] failed to record events", err);
  }
}

