import { permanentRedirect } from "next/navigation";

/**
 * Legacy bulk-import upload route — superseded by the Imports tab on
 * /supplier-invoices, which now embeds the dropzone directly. Redirecting
 * here lands the user on Imports so they can see existing pending scans
 * and drop new PDFs in the same surface.
 */
export default function SupplierInvoicesBulkImportPage(): never {
  permanentRedirect("/supplier-invoices?tab=inbox");
}
