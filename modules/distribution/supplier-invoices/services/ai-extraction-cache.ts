import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiExtractionCache } from "@/db/schema";

import { hashPdfBytes } from "../utils/pdf-content-hash";
import type { AiExtractionResult } from "./ai-provider";

// Re-export the hash function so callers that already depend on the cache
// service don't need a second import; the function lives in utils/ so the
// hashing can be tested without pulling in `server-only` + the DB driver.
export { hashPdfBytes };

// ---------------------------------------------------------------------------
// AI extraction cache — keyed on (tenant, PDF SHA-256, stage).
//
// Why this exists: re-uploading the same PDF is common during dev testing,
// supplier re-sends, and accidental double-uploads. Each one currently pays
// the full OpenAI cost. With caching, the first parse is normal cost; every
// subsequent identical upload from the same tenant is free at the AI layer.
//
// Why `tenant + hash` and not `hash` alone: the user message we send to
// OpenAI includes that tenant's known suppliers + product candidates. Two
// tenants uploading the same PDF would (legitimately) get different
// extractions because the AI picks supplierName from the candidate list.
// Cross-tenant sharing would also leak which suppliers another tenant has.
//
// Why store the RAW AiExtractionResult and not the PipelineResult: the
// pipeline does deterministic product matching after the AI call, and the
// catalog can change between cache writes and reads (products renamed,
// archived, added). Re-running matching on each cache hit means cached
// rows stay correct even when the catalog evolves.
// ---------------------------------------------------------------------------

export type CacheStage = "invoice_extraction" | "vision_extraction";

// Bump when extraction logic changes in a way that should invalidate prior
// cache entries (prompt rewrites, validation rule changes that override AI
// output like `reconcileUnitType` / `loose singles` overrides). Suffixed to
// `pdf_content_hash` on both read and write so old rows become unreachable;
// they remain in the table but are never read, and fresh writes use the new
// key. A future migration can clean up orphans.
const CACHE_KEY_VERSION = "v2";

function versionedHash(pdfContentHash: string): string {
  return `${pdfContentHash}:${CACHE_KEY_VERSION}`;
}

/**
 * Lookup. Returns the cached AiExtractionResult when one exists for
 * (tenant, hash, stage), or null on miss. Best-effort: a DB error returns
 * null and the pipeline falls through to a fresh AI call.
 */
export async function lookupAiExtractionCache(args: {
  tenantId: string;
  pdfContentHash: string;
  stage: CacheStage;
}): Promise<AiExtractionResult | null> {
  try {
    const [row] = await db
      .select({ json: aiExtractionCache.aiExtractionJson })
      .from(aiExtractionCache)
      .where(
        and(
          eq(aiExtractionCache.tenantId, args.tenantId),
          eq(aiExtractionCache.pdfContentHash, versionedHash(args.pdfContentHash)),
          eq(aiExtractionCache.stage, args.stage),
        ),
      )
      .limit(1);
    return (row?.json as AiExtractionResult | undefined) ?? null;
  } catch (err) {
    // Never let a cache failure break the parse. Pipeline falls through to
    // a normal AI call, paying the cost — annoying but correct.
    console.warn("[ai-extraction-cache] lookup failed", err);
    return null;
  }
}

/**
 * Write a successful AI extraction to the cache. Best-effort — failure
 * just means we didn't save a row, not that the parse failed. ON CONFLICT
 * (tenant_id, pdf_content_hash, stage) DO UPDATE so re-runs replace the
 * cached value with the latest (e.g. after a prompt or model upgrade).
 */
export async function saveAiExtractionCache(args: {
  tenantId: string;
  pdfContentHash: string;
  stage: CacheStage;
  model: string;
  sourceFilename: string | null;
  result: AiExtractionResult;
}): Promise<void> {
  // Don't cache failed results. The hash is content-stable; if a parse
  // failed on this PDF before, we should retry next time, not return the
  // cached failure.
  if (args.result.status !== "success") return;

  try {
    await db
      .insert(aiExtractionCache)
      .values({
        tenantId: args.tenantId,
        pdfContentHash: versionedHash(args.pdfContentHash),
        stage: args.stage,
        model: args.model,
        sourceFilename: args.sourceFilename,
        aiExtractionJson: args.result,
      })
      .onConflictDoUpdate({
        target: [
          aiExtractionCache.tenantId,
          aiExtractionCache.pdfContentHash,
          aiExtractionCache.stage,
        ],
        set: {
          aiExtractionJson: args.result,
          model: args.model,
          sourceFilename: args.sourceFilename,
          createdAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("[ai-extraction-cache] write failed", err);
  }
}
