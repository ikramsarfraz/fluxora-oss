"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  bulkImportFiles,
  supplierInvoiceAttachments,
  supplierInvoices,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export type BillPdfAvailability = {
  /** Whether forwarding with `attachedOriginal=true` will actually deliver a PDF. */
  available: boolean;
  /** Where the PDF lives, when available. Useful for telemetry / debugging. */
  source: "manual-upload" | "bulk-import" | null;
};

/**
 * The Forward modal calls this on mount to decide whether to enable the
 * "Original PDF" checkbox. There are two source paths for the PDF and
 * both can be missing on the same bill:
 *
 *   1. Manual upload via uploadSupplierInvoiceAttachmentAction →
 *      supplier_invoice_attachments → files
 *   2. Bulk import via bulkImportSupplierInvoicesAction →
 *      bulk_import_files (back-referenced by supplierInvoiceId on review)
 *
 * Bills posted through the single-upload `/supplier-invoices/new` parse
 * flow currently have NEITHER — the source PDF is parsed in memory and
 * discarded. Bills typed in directly with no PDF source obviously also
 * have neither. In both cases the modal should disable the checkbox so
 * the user knows up front the email won't carry a PDF.
 */
export async function checkBillPdfAvailability(
  supplierInvoiceId: string,
): Promise<BillPdfAvailability> {
  const tenant = await getCurrentTenant();

  // Tenant-scope check upfront so a forged invoiceId can't probe other
  // tenants' rows via the booleans we return.
  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, supplierInvoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    columns: { id: true },
  });
  if (!invoice) return { available: false, source: null };

  // Run both lookups in parallel.
  const [manualRow, bulkRow] = await Promise.all([
    db.query.supplierInvoiceAttachments.findFirst({
      where: eq(supplierInvoiceAttachments.supplierInvoiceId, supplierInvoiceId),
      columns: { fileId: true },
      orderBy: [desc(supplierInvoiceAttachments.createdAt)],
    }),
    db
      .select({ id: bulkImportFiles.id })
      .from(bulkImportFiles)
      .where(
        and(
          eq(bulkImportFiles.tenantId, tenant.id),
          eq(bulkImportFiles.supplierInvoiceId, supplierInvoiceId),
          isNull(bulkImportFiles.deletedAt),
        ),
      )
      .limit(1)
      .then(rows => rows[0] ?? null),
  ]);

  if (manualRow) return { available: true, source: "manual-upload" };
  if (bulkRow) return { available: true, source: "bulk-import" };
  return { available: false, source: null };
}
