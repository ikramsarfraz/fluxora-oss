import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenseAttachments, expenses, files } from "@/db/schema";
import { canManageExpenses } from "@/lib/expenses/metadata";
import {
  buildExpenseAttachmentObjectKey,
  deleteFile,
  getSignedDownloadUrl,
  uploadFile,
} from "@/lib/uploads/r2";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  getCurrentPortalUser,
  type PortalUserRole,
} from "@/modules/shared/services/portal-users";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — tighter than supplier invoices (50 MB)
                                    // because receipts are typically photos / single-page PDFs.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function extensionFromFilename(filename: string): string | null {
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return null;
  return filename.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || null;
}

async function requireExpenseManager() {
  const user = await getCurrentPortalUser();
  if (!canManageExpenses(user.role as PortalUserRole)) {
    throw new Error("Your role does not allow managing expense receipts.");
  }
  return user;
}

async function loadExpenseForAttachment(expenseId: string) {
  const tenant = await getCurrentTenant();
  const user = await requireExpenseManager();
  const expense = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)),
  });
  if (!expense) throw new Error("Expense not found.");
  return { tenant, user, expense };
}

export type UploadExpenseAttachmentInput = {
  expenseId: string;
  bytes: Buffer | Uint8Array;
  originalFilename: string;
  mimeType: string | null;
};

export async function uploadExpenseAttachment(input: UploadExpenseAttachmentInput) {
  const { tenant, user, expense } = await loadExpenseForAttachment(input.expenseId);

  if (input.bytes.byteLength === 0) {
    throw new Error("Receipt file is empty.");
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error(
      `Receipt is too large (max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB).`,
    );
  }
  const mimeType = input.mimeType?.toLowerCase() ?? "application/octet-stream";
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(
      `Unsupported file type "${mimeType}". Upload a JPEG, PNG, WebP, HEIC, or PDF.`,
    );
  }

  const originalFilename = input.originalFilename.slice(0, 512);
  const extension = extensionFromFilename(originalFilename);

  // Wrap the metadata writes in a transaction so a half-applied row can't
  // outlive a failure. Bytes are written AFTER the transaction commits —
  // a failed upload leaves no DB rows (we delete-restore is unnecessary).
  const inserted = await db.transaction(async tx => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        tenantId: tenant.id,
        category: "expense_attachment",
        storageProvider: "r2",
        status: "uploading",
        // Object key is patched after we know the file id.
        objectKey: `pending/${randomUUID()}`,
        bucket: null,
        originalFilename,
        mimeType,
        extension,
        sizeBytes: input.bytes.byteLength,
        uploadedByUserId: user.id,
      })
      .returning();

    const objectKey = buildExpenseAttachmentObjectKey({
      tenantId: tenant.id,
      expenseId: expense.id,
      fileId: fileRow.id,
      extension,
    });

    await tx
      .update(files)
      .set({ objectKey, status: "ready" })
      .where(eq(files.id, fileRow.id));

    await tx.insert(expenseAttachments).values({
      expenseId: expense.id,
      fileId: fileRow.id,
      tenantId: tenant.id,
    });

    return { fileId: fileRow.id, objectKey };
  });

  // Upload bytes after the DB row exists. If R2 fails we mark the file row
  // failed so a future sweep can prune it; we don't roll back the DB row
  // because the user can retry the upload.
  try {
    await uploadFile({
      objectKey: inserted.objectKey,
      body: input.bytes,
      contentType: mimeType,
      contentLength: input.bytes.byteLength,
    });
  } catch (err) {
    await db
      .update(files)
      .set({ status: "failed" })
      .where(eq(files.id, inserted.fileId));
    throw err;
  }

  return { fileId: inserted.fileId };
}

export type ExpenseAttachmentRow = {
  fileId: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
  uploadedByUserId: string | null;
};

export async function listExpenseAttachments(
  expenseId: string,
): Promise<ExpenseAttachmentRow[]> {
  const tenant = await getCurrentTenant();
  // Read path is gated on tenant scope only; viewing receipts mirrors the
  // detail-page read permission. Write paths still gate on canManageExpenses.
  const rows = await db
    .select({
      fileId: files.id,
      originalFilename: files.originalFilename,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      createdAt: expenseAttachments.createdAt,
      uploadedByUserId: files.uploadedByUserId,
    })
    .from(expenseAttachments)
    .innerJoin(files, eq(files.id, expenseAttachments.fileId))
    .where(
      and(
        eq(expenseAttachments.expenseId, expenseId),
        eq(expenseAttachments.tenantId, tenant.id),
        eq(files.status, "ready"),
      ),
    )
    .orderBy(desc(expenseAttachments.createdAt));
  return rows;
}

export async function getExpenseAttachmentDownloadUrl(input: {
  expenseId: string;
  fileId: string;
}): Promise<string> {
  const tenant = await getCurrentTenant();
  const row = await db
    .select({ objectKey: files.objectKey })
    .from(expenseAttachments)
    .innerJoin(files, eq(files.id, expenseAttachments.fileId))
    .where(
      and(
        eq(expenseAttachments.expenseId, input.expenseId),
        eq(expenseAttachments.fileId, input.fileId),
        eq(expenseAttachments.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (row.length === 0) throw new Error("Attachment not found.");
  return getSignedDownloadUrl(row[0].objectKey, 300); // 5-minute window — short
                                                       // because the UI redirects
                                                       // immediately on click.
}

export async function removeExpenseAttachment(input: {
  expenseId: string;
  fileId: string;
}) {
  const { tenant } = await loadExpenseForAttachment(input.expenseId);

  // Look up the object key inside the transaction so we can both delete
  // the DB rows AND know what to remove from R2.
  const objectKey = await db.transaction(async tx => {
    const attachment = await tx
      .select({ objectKey: files.objectKey })
      .from(expenseAttachments)
      .innerJoin(files, eq(files.id, expenseAttachments.fileId))
      .where(
        and(
          eq(expenseAttachments.expenseId, input.expenseId),
          eq(expenseAttachments.fileId, input.fileId),
          eq(expenseAttachments.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (attachment.length === 0) throw new Error("Attachment not found.");

    await tx
      .delete(expenseAttachments)
      .where(
        and(
          eq(expenseAttachments.expenseId, input.expenseId),
          eq(expenseAttachments.fileId, input.fileId),
          eq(expenseAttachments.tenantId, tenant.id),
        ),
      );
    // The files row is owned by this attachment (no other surface re-uses
    // expense attachment file rows) so delete it too. If we later share
    // file rows, swap this for a soft-delete (set deletedAt).
    await tx.delete(files).where(eq(files.id, input.fileId));

    return attachment[0].objectKey;
  });

  // Best-effort R2 cleanup — if it fails the DB rows are gone so the user
  // sees the attachment disappear; the orphaned object becomes a target
  // for a future sweep job.
  try {
    await deleteFile(objectKey);
  } catch {
    // Intentionally swallow — see comment above.
  }

  return { success: true as const };
}
