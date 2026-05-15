import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { BulkLandingLive } from "../components/bulk-landing/bulk-landing-live";

export default async function SupplierInvoicesBulkLandingPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  // Real-data wrapper — scans localStorage for the bulk-import handoffs the
  // legacy uploader wrote, renders the new BulkLandingScreen with them, and
  // links each Review action to the new Review screen via the existing
  // /supplier-invoices/new?bulk-import-key=… route.
  return <BulkLandingLive />;
}
