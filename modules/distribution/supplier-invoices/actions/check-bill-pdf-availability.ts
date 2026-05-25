"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  bulkImportFiles,
  files,
  supplierInvoiceAttachments,
  supplierInvoices,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { resolveOutboundFromAddress } from "@/lib/email-from-address";

export type BillPdfSource = {
  /**
   * Namespaced id, encodes the underlying table:
   *   `file:<uuid>`  — supplier_invoice_attachments.fileId (manual upload)
   *   `bulk:<uuid>`  — bulk_import_files.id
   * The Forward modal echoes selected ids back to forwardBillAction.
   */
  id: string;
  source: "manual-upload" | "bulk-import";
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Sort + display key. */
  uploadedAt: Date | null;
};

export type BillPdfAvailability = {
  /** Whether at least one PDF is available to attach. */
  available: boolean;
  /** All PDFs on file, newest first. The modal renders one checkbox per entry. */
  sources: BillPdfSource[];
  /**
   * Bare email the recipient will see in the From header. Matches what
   * forwardBillAction will actually send (resolved via the same
   * resolveOutboundFromAddress helper). Used by the modal's helper-text
   * preview so the displayed address is always truthful.
   */
  fromEmail: string;
  /** Display name shown alongside the from email — tenant brand. */
  fromDisplayName: string | null;
  /** The current user's email — Reply-To header value. */
  replyToEmail: string | null;
};

/**
 * The Forward modal calls this on mount to render its attachment picker.
 * Bills can have ANY of:
 *
 *   1. Multiple manual uploads via uploadSupplierInvoiceAttachmentAction
 *      → supplier_invoice_attachments → files
 *   2. A bulk-import original via bulkImportSupplierInvoicesAction
 *      → bulk_import_files (back-referenced by supplierInvoiceId on review)
 *
 * Bills posted through the single-upload `/supplier-invoices/new` parse
 * flow currently have NEITHER — the source PDF is parsed in memory and
 * discarded (tracked separately as #276). Bills typed in directly with
 * no PDF source obviously also have neither. The modal disables the
 * attachment block in those cases.
 */
export async function checkBillPdfAvailability(
  supplierInvoiceId: string,
): Promise<BillPdfAvailability> {
  const [tenant, currentUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  // From/Reply-To are independent of whether the invoice exists — compute
  // upfront so the modal can show them even before the PDF list resolves.
  const fromResolved = resolveOutboundFromAddress(tenant, "bills");
  const previewEnvelope = {
    fromEmail: fromResolved.email,
    fromDisplayName: fromResolved.displayName,
    replyToEmail: currentUser.email ?? null,
  };

  // Tenant-scope check upfront so a forged invoiceId can't probe other
  // tenants' rows via the lists we return.
  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, supplierInvoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    columns: { id: true },
  });
  if (!invoice) {
    return { available: false, sources: [], ...previewEnvelope };
  }

  // Pull every manual attachment + every bulk-import row tied to this
  // invoice in parallel. limit was the bug behind "only the last one
  // gets sent" — now we return the full list and let the modal decide
  // what to forward.
  const [manualRows, bulkRows] = await Promise.all([
    db
      .select({
        id: files.id,
        filename: files.originalFilename,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        uploadedAt: files.createdAt,
      })
      .from(supplierInvoiceAttachments)
      .innerJoin(files, eq(files.id, supplierInvoiceAttachments.fileId))
      .where(
        and(
          eq(supplierInvoiceAttachments.supplierInvoiceId, supplierInvoiceId),
          eq(files.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(supplierInvoiceAttachments.createdAt)),
    db
      .select({
        id: bulkImportFiles.id,
        filename: bulkImportFiles.filename,
        mimeType: bulkImportFiles.mimeType,
        sizeBytes: bulkImportFiles.sizeBytes,
        uploadedAt: bulkImportFiles.createdAt,
      })
      .from(bulkImportFiles)
      .where(
        and(
          eq(bulkImportFiles.tenantId, tenant.id),
          eq(bulkImportFiles.supplierInvoiceId, supplierInvoiceId),
          isNull(bulkImportFiles.deletedAt),
        ),
      )
      .orderBy(desc(bulkImportFiles.createdAt)),
  ]);

  const sources: BillPdfSource[] = [
    ...manualRows.map(r => ({
      id: `file:${r.id}`,
      source: "manual-upload" as const,
      filename: r.filename ?? "attachment.pdf",
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      uploadedAt: r.uploadedAt,
    })),
    ...bulkRows.map(r => ({
      id: `bulk:${r.id}`,
      source: "bulk-import" as const,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      uploadedAt: r.uploadedAt,
    })),
  ];
  // Newest-first across both sources.
  sources.sort((a, b) => {
    const at = a.uploadedAt?.getTime() ?? 0;
    const bt = b.uploadedAt?.getTime() ?? 0;
    return bt - at;
  });

  return { available: sources.length > 0, sources, ...previewEnvelope };
}
