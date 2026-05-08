import { DetailPageHeader } from "@/components/detail-page-header";

import { AddSupplierForm } from "../components/add-supplier-form";

export default function SuppliersNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Supplier"
        description="Create a new supplier for purchasing and invoicing."
      />
      <AddSupplierForm />
    </div>
  );
}
