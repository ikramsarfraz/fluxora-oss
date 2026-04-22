import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage adapter for the `files` table.
 *
 * File contents are written under `UPLOAD_DIR` (default `.uploads/` at the
 * repo root) and streamed back through an authenticated route handler, so
 * nothing lives under `public/` and the `object_key` stored in Postgres is
 * never exposed directly to clients.
 *
 * The `files.storage_provider` enum currently only accepts `"r2"`; we keep
 * that value in the DB row so a real R2/S3 adapter can replace this module
 * without a schema change or data migration.
 */

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), ".uploads");

function resolveAbsolutePath(objectKey: string): string {
  const full = path.resolve(UPLOAD_ROOT, objectKey);
  if (!full.startsWith(UPLOAD_ROOT + path.sep) && full !== UPLOAD_ROOT) {
    throw new Error("Invalid object key");
  }
  return full;
}

export function buildSupplierInvoiceObjectKey(args: {
  tenantId: string;
  supplierInvoiceId: string;
  fileId: string;
  extension?: string | null;
}): string {
  const ext =
    args.extension && args.extension.trim().length > 0
      ? `.${args.extension.trim().replace(/^\.+/, "").toLowerCase()}`
      : "";
  return path.posix.join(
    "tenants",
    args.tenantId,
    "supplier-invoices",
    args.supplierInvoiceId,
    `${args.fileId}${ext}`,
  );
}

export async function saveFileBytes(args: {
  objectKey: string;
  bytes: Buffer;
}): Promise<void> {
  const full = resolveAbsolutePath(args.objectKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, args.bytes);
}

export async function readFileBytes(objectKey: string): Promise<Buffer> {
  const full = resolveAbsolutePath(objectKey);
  return await readFile(full);
}

export async function deleteFileBytes(objectKey: string): Promise<void> {
  const full = resolveAbsolutePath(objectKey);
  try {
    await unlink(full);
  } catch (err) {
    // Don't fail the DB cleanup if the underlying bytes are already gone;
    // the row in `files` is the source of truth.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw err;
    }
  }
}
