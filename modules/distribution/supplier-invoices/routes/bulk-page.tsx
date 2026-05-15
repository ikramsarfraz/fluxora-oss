import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { BulkLandingDemo } from "../components/bulk-landing/bulk-landing-demo";

export default async function SupplierInvoicesBulkLandingPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  // Phase 2: presentational shell with mocked batch data. A real batch concept
  // (batch_id grouping uploaded files) is part of phase 5 (backend wiring).
  return <BulkLandingDemo />;
}
