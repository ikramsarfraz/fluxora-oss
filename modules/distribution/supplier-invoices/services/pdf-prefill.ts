import "server-only";

import { eq } from "drizzle-orm";
import pdfParse from "pdf-parse";

import { db } from "@/db";
import { products, suppliers } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import {
  parseSupplierInvoicePdfText,
  type SupplierInvoicePdfPrefillResult,
} from "@/lib/supplier-invoices/pdf-prefill";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export type { SupplierInvoicePdfPrefillResult };

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
}): Promise<SupplierInvoicePdfPrefillResult> {
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
  if (text.length < 20) {
    throw new Error(
      "This PDF does not contain readable text yet. Scanned/image invoices are not supported in this first version.",
    );
  }

  const [supplierRows, productRows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenant.id)),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(eq(products.tenantId, tenant.id)),
  ]);

  return parseSupplierInvoicePdfText({
    text,
    sourceFilename: originalFilename,
    suppliers: supplierRows,
    products: productRows,
  });
}
