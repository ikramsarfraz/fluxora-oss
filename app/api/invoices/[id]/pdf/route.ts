import { getSalesInvoiceById } from "@/modules/distribution/invoices/services/invoicing";
import { getCurrentTenant, getTenantLogoUrl } from "@/modules/core/tenants/services/tenants";
import { isUuid } from "@/lib/utils/uuid";
import {
  getSalesInvoicePdfFilename,
  renderSalesInvoicePdf,
} from "@/lib/invoices/sales-invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
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

  const logoUrl = await getTenantLogoUrl(tenant).catch(() => null);

  const pdfBytes = await renderSalesInvoicePdf({
    tenant,
    invoice,
    logoUrl,
  });

  // `renderToBuffer` returns a Node `Buffer`. Copy into a plain Uint8Array
  // backed by a non-shared ArrayBuffer so TS's `BodyInit` type matches.
  const pdfBody = new Uint8Array(pdfBytes.byteLength);
  pdfBody.set(pdfBytes);
  const url = new URL(request.url);
  const disposition =
    url.searchParams.get("preview") === "1" ? "inline" : "attachment";

  return new Response(pdfBody, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${getSalesInvoicePdfFilename(invoice)}"`,
      "Content-Length": String(pdfBody.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
