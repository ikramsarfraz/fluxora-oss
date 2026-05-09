import "server-only";

import pdfParse from "pdf-parse";

import { requirePermission } from "@/lib/auth/permissions";
import {
  parseSupplierInvoicePdfText,
  type SupplierInvoicePdfPrefillResult,
} from "../utils/pdf-prefill";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  runParsingPipeline,
  scoreParseResult,
  type PipelineResult,
} from "./parsing-pipeline";

export type { SupplierInvoicePdfPrefillResult };
export type { PipelineResult };

const MAX_PDF_PREFILL_BYTES = 25 * 1024 * 1024;

function isPdfFile(args: {
  originalFilename: string;
  mimeType: string | null;
}): boolean {
  const filenameLooksPdf = /\.pdf$/i.test(args.originalFilename.trim());
  const mimeLooksPdf = args.mimeType === "application/pdf";
  return filenameLooksPdf || mimeLooksPdf;
}

export async function parseSupplierInvoicePdf(input: {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
}): Promise<PipelineResult> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const originalFilename = input.originalFilename.trim();
  if (!originalFilename) {
    throw new Error("PDF file must have a name.");
  }
  if (!isPdfFile({ originalFilename, mimeType: input.mimeType })) {
    throw new Error("Upload a PDF invoice to prefill this bill.");
  }
  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new Error("Uploaded PDF is empty.");
  }
  if (input.bytes.byteLength > MAX_PDF_PREFILL_BYTES) {
    throw new Error(
      `PDF is too large. Maximum is ${MAX_PDF_PREFILL_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const parsed = await pdfParse(input.bytes);
  const text = parsed.text?.trim() ?? "";
  const pageCount = parsed.numpages ?? 1;

  return runParsingPipeline({
    extractedText: text,
    sourceFilename: originalFilename,
    tenantId: tenant.id,
    pdfPageCount: pageCount,
    pdfBytes: input.bytes,
    debug: process.env.NODE_ENV === "development",
  });
}

// ---------------------------------------------------------------------------
// Legacy entry point — returns the same shape as before for backward compat.
// Callers that haven't migrated to PipelineResult can use this.
// ---------------------------------------------------------------------------

export async function parseSupplierInvoicePdfLegacy(input: {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
}): Promise<SupplierInvoicePdfPrefillResult> {
  const result = await parseSupplierInvoicePdf(input);
  return result.prefillResult;
}

export { scoreParseResult, parseSupplierInvoicePdfText };
