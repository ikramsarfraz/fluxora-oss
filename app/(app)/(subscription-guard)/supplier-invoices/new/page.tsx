import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/services/portal-users";

import { SupplierInvoiceForm } from "../components/supplier-invoice-form";

export default async function NewSupplierInvoicePage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  return <SupplierInvoiceForm mode="create" />;
}
