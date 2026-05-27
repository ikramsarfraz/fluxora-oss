import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { hasFeature } from "@/modules/core/feature-flags";
import { AI_ASSISTED_ENTRY_FEATURE } from "@/modules/distribution/orders/feature";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { SupplierInvoiceCreateShell } from "../components/supplier-invoice-create-shell";

export default async function SupplierInvoicesNewPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  const aiAssistedEntryEnabled = await hasFeature(
    currentUser.tenantId,
    AI_ASSISTED_ENTRY_FEATURE,
  );

  return (
    <SupplierInvoiceCreateShell
      aiAssistedEntryEnabled={aiAssistedEntryEnabled}
    />
  );
}
