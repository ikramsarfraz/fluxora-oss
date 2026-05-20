import { DetailPageHeader } from "@/components/detail-page-header";

import { AddSupplierForm } from "../components/add-supplier-form";
import { SupplierFormSidePanel } from "../components/supplier-form-side-panel";

export default function SuppliersNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Supplier"
        description="Create a new supplier for purchasing and invoicing."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AddSupplierForm stickyFooter />
        <SupplierFormSidePanel />
      </div>
    </div>
  );
}
