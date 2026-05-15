import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { BulkImportPanel } from "../components/bulk-import-panel";

export default async function SupplierInvoicesBulkImportPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  return (
    <div style={{ padding: "24px 24px 48px", maxWidth: 980 }}>
      <BulkImportPanel />
    </div>
  );
}
