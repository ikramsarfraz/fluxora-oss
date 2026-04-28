import { notFound } from "next/navigation";

import { DetailPageHeader } from "@/components/detail-page-header";
import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/services/portal-users";

import { SupplierInvoiceForm } from "../components/supplier-invoice-form";

export default async function NewSupplierInvoicePage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) {
    notFound();
  }
  if (!can(currentUser.role, "edit_supplier_invoice")) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-6">
      <DetailPageHeader
        title="New supplier invoice"
        description="Record a supplier shipment. Save a draft while you gather details, or complete the invoice to auto-generate lots and inventory."
      />
      <SupplierInvoiceForm mode="create" />
    </section>
  );
}
