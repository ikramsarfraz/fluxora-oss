export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isUuid } from "@/lib/utils/uuid";
import { getSupportTicketAttachmentDownload } from "@/modules/core/platform-admin/support/services/support";

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
      await getSupportTicketAttachmentDownload({ ticketId: id, fileId });
    const url = new URL(req.url);
    const disposition =
      url.searchParams.get("download") === "1" ? "attachment" : "inline";
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Forbidden"
        ? 403
        : message.toLowerCase().includes("not found")
          ? 404
          : 500;
    if (status === 500) console.error(error);
    return NextResponse.json({ error: message }, { status });
  }
}
