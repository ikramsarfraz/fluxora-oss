import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.R2_BUCKET_NAME ?? "erp-r2";
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  throw new Error(
    "R2 storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
  );
}

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// Object-key builders
// ---------------------------------------------------------------------------

export function buildTenantLogoObjectKey(args: {
  tenantId: string;
  fileId: string;
  extension?: string | null;
}): string {
  const ext =
    args.extension?.trim().replace(/^\.+/, "").toLowerCase() ?? "";
  const suffix = ext ? `.${ext}` : "";
  return `tenants/${args.tenantId}/branding/logo/${args.fileId}${suffix}`;
}

export function buildSupplierInvoiceObjectKey(args: {
  tenantId: string;
  supplierInvoiceId: string;
  fileId: string;
  extension?: string | null;
}): string {
  const ext =
    args.extension?.trim().replace(/^\.+/, "").toLowerCase() ?? "";
  const suffix = ext ? `.${ext}` : "";
  return `tenants/${args.tenantId}/supplier-invoices/${args.supplierInvoiceId}/${args.fileId}${suffix}`;
}

export function buildSalesOrderObjectKey(args: {
  tenantId: string;
  salesOrderId: string;
  fileId: string;
  extension?: string | null;
}): string {
  const ext =
    args.extension?.trim().replace(/^\.+/, "").toLowerCase() ?? "";
  const suffix = ext ? `.${ext}` : "";
  return `tenants/${args.tenantId}/sales-orders/${args.salesOrderId}/${args.fileId}${suffix}`;
}

// ---------------------------------------------------------------------------
// R2 I/O
// ---------------------------------------------------------------------------

export async function uploadFile(args: {
  objectKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
  contentLength: number;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: args.objectKey,
      Body: args.body,
      ContentType: args.contentType,
      ContentLength: args.contentLength,
    }),
  );
}

export async function downloadFile(objectKey: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }),
  );
  if (!response.Body) throw new Error(`R2 object not found: ${objectKey}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(objectKey: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }),
  );
}

/**
 * Returns a temporary signed GET URL valid for `expiresInSeconds` (default 1 h).
 */
export async function getSignedDownloadUrl(
  objectKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }),
    { expiresIn: expiresInSeconds },
  );
}
