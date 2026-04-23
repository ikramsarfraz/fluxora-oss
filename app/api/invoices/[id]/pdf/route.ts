import { getSalesInvoiceById } from "@/services/invoicing";
import { getCurrentTenant } from "@/services/tenants";
import { isUuid } from "@/lib/utils/uuid";
import {
  getSalesInvoicePdfFilename,
  renderSalesInvoicePdf,
} from "@/lib/invoices/sales-invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await ctx.params;

  if (!isUuid(id)) {
    return new Response("Not found", { status: 404 });
  }

  const [tenant, invoice] = await Promise.all([
    getCurrentTenant(),
    getSalesInvoiceById(id),
  ]);

  if (!invoice) {
    return new Response("Not found", { status: 404 });
  }

  const pdfBytes = await renderSalesInvoicePdf({
    companyName: tenant.name,
    invoice,
  });

  // `renderToBuffer` returns a Node `Buffer`. Copy into a plain Uint8Array
  // backed by a non-shared ArrayBuffer so TS's `BodyInit` type matches.
  const pdfBody = new Uint8Array(pdfBytes.byteLength);
  pdfBody.set(pdfBytes);

  return new Response(pdfBody, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${getSalesInvoicePdfFilename(invoice)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
