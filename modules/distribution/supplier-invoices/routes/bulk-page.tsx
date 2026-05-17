import { permanentRedirect } from "next/navigation";

/**
 * Legacy bulk-landing route — superseded by the Inbox tab on
 * /supplier-invoices. Kept as a 308 redirect so any bookmarked or
 * cross-referenced links (e.g. the review-container's back button, queue
 * carousel's "Back to bulk import") land in the right place.
 *
 * Safe to delete once we've audited every internal caller; for now the
 * redirect is the lowest-risk path.
 */
export default function SupplierInvoicesBulkLandingPage(): never {
  permanentRedirect("/supplier-invoices?tab=inbox");
}
