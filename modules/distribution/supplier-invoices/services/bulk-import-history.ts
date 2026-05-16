import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { bulkImportFiles } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import {
  buildBulkImportObjectKey,
  downloadFile as r2DownloadFile,
  getSignedDownloadUrl,
  uploadFile as r2UploadFile,
} from "@/lib/uploads/r2";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

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

export type BulkImportFileStatus = "parsed" | "reviewed" | "errored";

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
  reviewedAt: Date | null;
  supplierInvoiceId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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
        eq(bulkImportFiles.status, "parsed"),
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
 * retained — storage is cheap and recovery is "set deleted_at = null".
 * Phase B wires this up to a UI affordance; Phase A defines the operation
 * so the wiring above is ready to call.
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
    reviewedAt: row.reviewedAt,
    supplierInvoiceId: row.supplierInvoiceId,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
