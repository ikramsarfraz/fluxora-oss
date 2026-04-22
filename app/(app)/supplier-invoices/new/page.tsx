import { DetailPageHeader } from "@/components/detail-page-header";

import { SupplierInvoiceForm } from "../components/supplier-invoice-form";

export default function NewSupplierInvoicePage() {
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
