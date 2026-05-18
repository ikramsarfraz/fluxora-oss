import "server-only";

import { and, count, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { bulkImportFiles, supplierInvoices } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import {
  buildBulkImportObjectKey,
  downloadFile as r2DownloadFile,
  getSignedDownloadUrl,
  uploadFile as r2UploadFile,
} from "@/lib/uploads/r2";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

import type { AiExtractionErrorCode } from "./ai-provider";
import type { PipelineResult } from "./parsing-pipeline";

// ---------------------------------------------------------------------------
// Durable bulk-import history. Replaces the 24h localStorage handoff with a
// server-side record: one row per uploaded PDF, parsed PipelineResult JSON
// frozen at upload time, original PDF stored in R2. PR A2 will migrate the
// client off localStorage to read from these rows; PR B layers soft-delete
// on top.
//
// All reads enforce tenant scoping via getCurrentTenant() + portal-user
// session. Direct DB callers in the same module bypass that — see the writer
// in `bulk-import.ts` which already has the tenant id from the action layer.
// ---------------------------------------------------------------------------

export type BulkImportFileStatus =
  | "parsed"
  | "reviewed"
  | "errored"
  | "parse_error";

export type BulkImportFileRow = {
  id: string;
  tenantId: string;
  uploadedByUserId: string | null;
  batchId: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  objectKey: string;
  pipelineResult: PipelineResult | null;
  status: BulkImportFileStatus;
  /** Non-null only when `status === "parse_error"`. */
  parseErrorCodes: AiExtractionErrorCode[] | null;
  reviewedAt: Date | null;
  supplierInvoiceId: string | null;
  deletedAt: Date | null;
  /** Portal-user id currently holding the advisory review claim, or null. */
  claimedByUserId: string | null;
  /** Last heartbeat timestamp — used to detect a stale (expired) claim. */
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * How long a claim stays valid without a heartbeat. The shell heartbeats
 * every ~60s, so 3 minutes gives generous slack — enough to absorb a slow
 * network round-trip without booting a still-active reviewer, but short
 * enough that a closed tab doesn't permanently strand the row.
 */
export const BULK_IMPORT_CLAIM_TTL_MS = 3 * 60 * 1000;

// ---------------------------------------------------------------------------
// Writes — called by bulk-import.ts after parsing each file. The action layer
// guarantees we already have the tenant + user; passing them in instead of
// re-resolving avoids redundant DB hits per file.
// ---------------------------------------------------------------------------

export type CreateBulkImportFileInput = {
  tenantId: string;
  uploadedByUserId: string;
  batchId: string;
  filename: string;
  mimeType: string | null;
  bytes: Buffer;
  pipelineResult: PipelineResult | null;
  status: BulkImportFileStatus;
  /** Propagated to `bulk_import_files.parse_error_codes`; should be set
   *  when `status === "parse_error"`. */
  parseErrorCodes?: AiExtractionErrorCode[];
};

export type CreatedBulkImportFile = {
  id: string;
  objectKey: string;
};

/**
 * Persist one bulk-import file: upload the PDF to R2 and insert the row.
 * Throws if either step fails — the caller (bulk-import.ts) catches and
 * downgrades the per-file result to status="error" so a single bad row
 * doesn't sink the whole batch.
 */
export async function createBulkImportFile(
  input: CreateBulkImportFileInput,
): Promise<CreatedBulkImportFile> {
  const id = crypto.randomUUID();
  const objectKey = buildBulkImportObjectKey({
    tenantId: input.tenantId,
    batchId: input.batchId,
    fileId: id,
    extension: "pdf",
  });

  await r2UploadFile({
    objectKey,
    body: input.bytes,
    contentType: input.mimeType ?? "application/pdf",
    contentLength: input.bytes.byteLength,
  });

  await db.insert(bulkImportFiles).values({
    id,
    tenantId: input.tenantId,
    uploadedByUserId: input.uploadedByUserId,
    batchId: input.batchId,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    objectKey,
    pipelineResult: input.pipelineResult,
    status: input.status,
    parseErrorCodes: input.parseErrorCodes ?? null,
  });

  return { id, objectKey };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Pending bulk-import files for the current tenant — anything not yet
 * reviewed and not soft-deleted. Sorted oldest-first so the queue carousel
 * + landing screen present the longest-pending row at the front.
 */
export async function listPendingBulkImportFiles(): Promise<BulkImportFileRow[]> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  const rows = await db
    .select()
    .from(bulkImportFiles)
    .where(
      and(
        eq(bulkImportFiles.tenantId, tenant.id),
        // Pending = needs user attention: either successfully parsed (queue
        // card to review) or parse_error (callout to re-upload). `reviewed`
        // is the terminal "done" state and stays out.
        or(
          eq(bulkImportFiles.status, "parsed"),
          eq(bulkImportFiles.status, "parse_error"),
        ),
        isNull(bulkImportFiles.deletedAt),
      ),
    )
    .orderBy(bulkImportFiles.createdAt);

  return rows.map(rowToDomain);
}

/**
 * Single bulk-import file, tenant-scoped. Returns null when the row doesn't
 * exist or belongs to another tenant — never throw on "not found" so the
 * Review screen can degrade gracefully when a sibling tab completes the row.
 */
export async function getBulkImportFile(
  id: string,
): Promise<BulkImportFileRow | null> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  const [row] = await db
    .select()
    .from(bulkImportFiles)
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
      ),
    )
    .limit(1);

  return row ? rowToDomain(row) : null;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * Flip the row to `reviewed` once the user has posted a bill from it. The
 * caller passes the new supplier_invoice id so the bulk-landing screen can
 * cross-link to the finished bill. Idempotent — calling twice is a no-op
 * because the WHERE filter excludes already-reviewed rows.
 */
export async function markBulkImportFileReviewed(args: {
  id: string;
  supplierInvoiceId: string;
}): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");

  await db
    .update(bulkImportFiles)
    .set({
      status: "reviewed",
      reviewedAt: new Date(),
      supplierInvoiceId: args.supplierInvoiceId,
    })
    .where(
      and(
        eq(bulkImportFiles.id, args.id),
        eq(bulkImportFiles.tenantId, tenant.id),
        eq(bulkImportFiles.status, "parsed"),
      ),
    );
}

/**
 * Soft-delete a bulk-import row. The underlying R2 object is intentionally
 * retained — storage is cheap and recovery is `restoreBulkImportFile`,
 * which just clears `deletedAt`.
 */
export async function softDeleteBulkImportFile(id: string): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");

  await db
    .update(bulkImportFiles)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
        isNull(bulkImportFiles.deletedAt),
      ),
    );
}

/**
 * Restore a previously soft-deleted bulk-import row. Powers the "Undo"
 * affordance on the bulk-landing screen — the toast that fires after a
 * dismiss stays around for ~6s and clicking it calls back through here.
 * Idempotent: restoring a row that isn't deleted is a no-op.
 */
export async function restoreBulkImportFile(id: string): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");

  await db
    .update(bulkImportFiles)
    .set({ deletedAt: null })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
      ),
    );
}

// ---------------------------------------------------------------------------
// Advisory claim — prevents two reviewers from racing on the same queue row.
// The shell calls claim() on mount + heartbeat() every minute + release() on
// unmount. Strictly advisory: the existing `status = 'parsed'` filter on
// markBulkImportFileReviewed already prevents double-posts. The claim's job
// is UX (don't let both reviewers waste effort) not data integrity.
// ---------------------------------------------------------------------------

export type BulkImportClaimResult =
  | { ok: true; row: BulkImportFileRow }
  | {
      ok: false;
      reason: "claimed_by_other";
      claimedByUserId: string;
      claimedAt: Date | null;
    }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_reviewed" };

/**
 * Try to grab the advisory claim on this row. Succeeds atomically when:
 *  - no one holds it, OR
 *  - the previous holder's heartbeat is stale (older than the TTL), OR
 *  - the current user is already the holder (idempotent — also bumps the
 *    heartbeat, so this doubles as a "still here" ping after a tab reload).
 *
 * Refuses when another live reviewer holds it. The caller is responsible
 * for surfacing that to the user (read-only banner with the holder's
 * display name) — both happy and refused paths return enough info.
 *
 * Happy path is one DB roundtrip — we try the conditional UPDATE first
 * and only fall back to a SELECT when it refuses, to disambiguate
 * not_found / already_reviewed / claimed_by_other. Local dev against a
 * remote Neon, two sequential queries adds noticeable banner-flash; the
 * single-roundtrip path keeps the perceived delay short.
 */
export async function claimBulkImportFile(
  id: string,
): Promise<BulkImportClaimResult> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const now = new Date();
  const staleBefore = new Date(now.getTime() - BULK_IMPORT_CLAIM_TTL_MS);

  const [updated] = await db
    .update(bulkImportFiles)
    .set({ claimedByUserId: currentUser.id, claimedAt: now })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
        isNull(bulkImportFiles.deletedAt),
        // Refuse to claim a row that's already been posted — the
        // disambiguating SELECT below will surface this to the caller
        // as `already_reviewed`.
        ne(bulkImportFiles.status, "reviewed"),
        or(
          isNull(bulkImportFiles.claimedByUserId),
          eq(bulkImportFiles.claimedByUserId, currentUser.id),
          lt(bulkImportFiles.claimedAt, staleBefore),
        ),
      ),
    )
    .returning();

  if (updated) {
    return { ok: true, row: rowToDomain(updated) };
  }

  // UPDATE matched zero rows — figure out which terminal state we're
  // in so the UI can render the right banner.
  const existing = await getBulkImportFile(id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "reviewed") {
    return { ok: false, reason: "already_reviewed" };
  }
  return {
    ok: false,
    reason: "claimed_by_other",
    claimedByUserId: existing.claimedByUserId ?? "",
    claimedAt: existing.claimedAt,
  };
}

/**
 * Refresh the claim heartbeat. The shell calls this every ~60s while the
 * reviewer has the row open. Idempotent — only updates when the caller
 * still holds the claim, so a stolen claim (after stale-out) stays stolen.
 * Returns true on success so the client can detect the takeover case and
 * back off into a read-only banner.
 */
export async function heartbeatBulkImportFile(id: string): Promise<boolean> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");

  const [updated] = await db
    .update(bulkImportFiles)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
        eq(bulkImportFiles.claimedByUserId, currentUser.id),
      ),
    )
    .returning({ id: bulkImportFiles.id });

  return Boolean(updated);
}

/**
 * Release the claim. Called on shell unmount + after a successful submit.
 * Idempotent — releasing a row this user doesn't hold is a no-op. Also
 * doesn't touch `updatedAt` (would mis-trigger the queue re-fetch chain).
 */
export async function releaseBulkImportFile(id: string): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");

  await db
    .update(bulkImportFiles)
    .set({
      claimedByUserId: null,
      claimedAt: null,
      // Skip the $onUpdate hook for updatedAt — releasing the claim is
      // not a content change and shouldn't bust queue-blob caches that
      // include updatedAt in their key.
      updatedAt: sql`${bulkImportFiles.updatedAt}`,
    })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
        eq(bulkImportFiles.claimedByUserId, currentUser.id),
      ),
    );
}

// ---------------------------------------------------------------------------
// PDF fetch — used by the Review screen + parsing screen to render the
// original PDF. Two flavours: download bytes server-side (for re-parse) or
// hand back a short-lived signed URL the browser can fetch directly.
// ---------------------------------------------------------------------------

export async function downloadBulkImportPdf(id: string): Promise<{
  bytes: Buffer;
  filename: string;
  mimeType: string | null;
} | null> {
  const row = await getBulkImportFile(id);
  if (!row) return null;
  const bytes = await r2DownloadFile(row.objectKey);
  return { bytes, filename: row.filename, mimeType: row.mimeType };
}

/**
 * Re-run the AI parse pipeline against the PDF bytes already stored
 * in R2 for this row, and write the fresh `pipelineResult` /
 * `parseErrorCodes` / `status` back to `bulk_import_files`. Used by
 * the review queue's "Re-scan" affordance when the original parse
 * mis-mapped lines or failed mid-stream — saves the reviewer from
 * having to delete + re-upload (which loses the queue position).
 *
 * Returns the updated row so callers can update local caches. Throws
 * if the row is missing, soft-deleted, or already reviewed (re-scan
 * after post would create misleading state — the bill is already on
 * inventory and re-parsing the source doesn't change that).
 *
 * Imports `parseSupplierInvoicePdf` lazily because pdf-prefill pulls
 * in pdfjs-dist + the AI provider — heavy modules we only want loaded
 * on the parse paths, not every page that imports this service.
 */
export async function rescanBulkImportFile(id: string): Promise<BulkImportFileRow> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const row = await getBulkImportFile(id);
  if (!row) throw new Error("Bulk import file not found.");
  if (row.status === "reviewed") {
    throw new Error(
      "This file has already been posted. Re-scanning would create misleading state — delete the posted bill first if you need to redo it.",
    );
  }

  const bytes = await r2DownloadFile(row.objectKey);
  const { parseSupplierInvoicePdf } = await import("./pdf-prefill");
  const pipeline = await parseSupplierInvoicePdf({
    originalFilename: row.filename,
    mimeType: row.mimeType,
    bytes,
  });

  const nextStatus: BulkImportFileStatus =
    pipeline.parseStatus === "parse_error" ? "parse_error" : "parsed";

  const [updated] = await db
    .update(bulkImportFiles)
    .set({
      pipelineResult: pipeline,
      status: nextStatus,
      parseErrorCodes:
        nextStatus === "parse_error" ? pipeline.parseErrorCodes : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bulkImportFiles.id, id),
        eq(bulkImportFiles.tenantId, tenant.id),
        isNull(bulkImportFiles.deletedAt),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Rescan succeeded but the row vanished — was it deleted?");
  }
  return rowToDomain(updated);
}

export async function getBulkImportPdfSignedUrl(
  id: string,
): Promise<string | null> {
  const row = await getBulkImportFile(id);
  if (!row) return null;
  return getSignedDownloadUrl(row.objectKey);
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * Look up every pending row in a given batch — used by the queue carousel
 * to anchor "files imported together" at startup before the user navigates.
 */
export async function listPendingBulkImportFilesInBatches(
  batchIds: string[],
): Promise<BulkImportFileRow[]> {
  if (batchIds.length === 0) return [];
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  const rows = await db
    .select()
    .from(bulkImportFiles)
    .where(
      and(
        eq(bulkImportFiles.tenantId, tenant.id),
        inArray(bulkImportFiles.batchId, batchIds),
        isNull(bulkImportFiles.deletedAt),
      ),
    )
    .orderBy(desc(bulkImportFiles.createdAt));

  return rows.map(rowToDomain);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function rowToDomain(
  row: typeof bulkImportFiles.$inferSelect,
): BulkImportFileRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    uploadedByUserId: row.uploadedByUserId,
    batchId: row.batchId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    objectKey: row.objectKey,
    // `pipelineResult` is typed as `unknown` by Drizzle's jsonb column. The
    // service stamps the right shape on write, so casting on read is the
    // right call — the only place that wouldn't hold is a manual SQL edit,
    // which would corrupt the queue carousel regardless.
    pipelineResult: row.pipelineResult as PipelineResult | null,
    status: row.status,
    parseErrorCodes: (row.parseErrorCodes as AiExtractionErrorCode[] | null) ?? null,
    reviewedAt: row.reviewedAt,
    supplierInvoiceId: row.supplierInvoiceId,
    deletedAt: row.deletedAt,
    claimedByUserId: row.claimedByUserId,
    claimedAt: row.claimedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Supplier performance — drives the queue-card badge so a reviewer can
// sequence their work ("knock out the trusted suppliers first, leave the
// new one for when I have time").
//
// MVP heuristic: count of past supplier_invoices per supplier in this
// tenant. The hypothesis is well-validated by support tickets — by the
// 5th invoice from a vendor, the alias mappings + parsing patterns are
// usually well-established, so parses are clean. Brand-new vendors
// require manual product mapping for every line.
//
// More-nuanced metrics (price stability, review-friction average) can
// layer on later without changing the action shape — the bucket field
// is intentionally opaque to callers.
// ---------------------------------------------------------------------------

export type SupplierPerformanceBucket = "green" | "yellow" | "red";

export type SupplierPerformanceStats = {
  supplierId: string;
  /** Posted invoices for this supplier in the tenant, all-time. */
  totalBills: number;
  /** Coarse bucket the UI maps to a colored dot. */
  bucket: SupplierPerformanceBucket;
};

export async function getSupplierPerformanceStats(
  supplierIds: string[],
): Promise<SupplierPerformanceStats[]> {
  if (supplierIds.length === 0) return [];
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  // Distinct to avoid duplicate work + bounded payload — the queue rarely
  // has more than a dozen unique suppliers at once.
  const uniqueIds = Array.from(new Set(supplierIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const rows = await db
    .select({
      supplierId: supplierInvoices.supplierId,
      bills: count(),
    })
    .from(supplierInvoices)
    .where(
      and(
        eq(supplierInvoices.tenantId, tenant.id),
        inArray(supplierInvoices.supplierId, uniqueIds),
      ),
    )
    .groupBy(supplierInvoices.supplierId);

  const byId = new Map<string, number>();
  for (const r of rows) byId.set(r.supplierId, Number(r.bills) || 0);

  // Always return a row for every requested id so callers don't have to
  // distinguish "unknown" from "zero bills" — the bucket is the answer.
  return uniqueIds.map(id => {
    const total = byId.get(id) ?? 0;
    return {
      supplierId: id,
      totalBills: total,
      bucket: bucketFor(total),
    };
  });
}

function bucketFor(totalBills: number): SupplierPerformanceBucket {
  if (totalBills >= 5) return "green"; // Trusted, alias map mature.
  if (totalBills >= 1) return "yellow"; // Some history.
  return "red"; // Brand-new vendor — expect to map every product manually.
}
