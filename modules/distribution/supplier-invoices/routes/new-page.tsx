import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { SupplierInvoiceCreateShell } from "../components/supplier-invoice-create-shell";

export default async function SupplierInvoicesNewPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  return <SupplierInvoiceCreateShell />;
}
