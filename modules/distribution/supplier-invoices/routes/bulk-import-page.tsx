import { permanentRedirect } from "next/navigation";

/**
 * Legacy bulk-import upload route — superseded by the in-page BulkImportSheet
 * triggered from SupplierBillsShell. Redirecting here lands the user on the
 * Inbox tab so they can see existing pending parses while the sheet is
 * available a click away from the header.
 *
 * (We deliberately don't auto-open the sheet on landing — the redirect is a
 * navigation, and clicking "Bulk import" from anywhere is the canonical way
 * to open it. Auto-opening from a URL state would diverge.)
 */
export default function SupplierInvoicesBulkImportPage(): never {
  permanentRedirect("/supplier-invoices?tab=inbox");
}
