export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isUuid } from "@/lib/utils/uuid";
import { getSalesOrderAttachmentDownload } from "@/modules/distribution/orders/services/orders";

/**
 * GET /api/sales-orders/:id/attachments/:fileId
 *
 * Streams the bytes for a sales order attachment after enforcing tenant
 * ownership (inside the service call).
 * `?download=1` forces Content-Disposition: attachment; otherwise the
 * browser may inline-render (e.g. PDFs, images).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await context.params;
    if (!isUuid(id) || !isUuid(fileId)) {
      return NextResponse.json(
        { error: "Invalid attachment id" },
        { status: 400 },
      );
    }

    const { bytes, mimeType, originalFilename, sizeBytes } =
      await getSalesOrderAttachmentDownload({
        salesOrderId: id,
        fileId,
      });

    const url = new URL(req.url);
    const forceDownload = url.searchParams.get("download") === "1";
    const disposition = forceDownload ? "attachment" : "inline";
    const safeFilename = originalFilename.replace(/"/g, "");

    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(sizeBytes),
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
    if (status === 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}
