import { NextResponse } from "next/server";

import { isUuid } from "@/lib/utils/uuid";
import {
  downloadBulkImportPdf,
  getBulkImportFile,
} from "@/modules/distribution/supplier-invoices/services/bulk-import-history";

/**
 * GET /api/supplier-invoices/:id/bulk-import/:bulkId
 *
 * Streams the source PDF for a bulk-import row that's already been
 * reviewed into a supplier invoice. Used by the detail-page preview
 * pane when the user picks the bulk-import original from the segmented
 * file picker.
 *
 * Mirrors `/api/supplier-invoices/:id/attachments/:fileId` (the manual-
 * upload route) so the preview iframe can use the same Content-Type
 * inline behaviour regardless of which source the user picked.
 *
 * Tenant + permission checks happen inside getBulkImportFile (throws
 * "Forbidden" / requirePermission("view_supplier_invoice")). We also
 * verify the bulk-import row is back-referenced to THIS supplier
 * invoice id — defense-in-depth against forged URL params.
 *
 * `?download=1` forces Content-Disposition: attachment; otherwise the
 * browser inline-renders.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; bulkId: string }> },
) {
  try {
    const { id, bulkId } = await context.params;
    if (!isUuid(id) || !isUuid(bulkId)) {
      return NextResponse.json(
        { error: "Invalid attachment id" },
        { status: 400 },
      );
    }

    const row = await getBulkImportFile(bulkId);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.supplierInvoiceId !== id) {
      // Either the param-id is forged or the bulk-import row hasn't
      // been reviewed into this invoice. Either way, 404 so we don't
      // leak the fact that the row exists for some other bill.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const downloaded = await downloadBulkImportPdf(bulkId);
    if (!downloaded) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const forceDownload = url.searchParams.get("download") === "1";
    const disposition = forceDownload ? "attachment" : "inline";
    const safeFilename = downloaded.filename.replace(/"/g, "");

    return new NextResponse(new Uint8Array(downloaded.bytes), {
      status: 200,
      headers: {
        "Content-Type": downloaded.mimeType ?? "application/pdf",
        "Content-Length": String(downloaded.bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "Forbidden"
        ? 403
        : message.includes("not found")
          ? 404
          : 500;
    if (status === 500) {
      console.error(err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
