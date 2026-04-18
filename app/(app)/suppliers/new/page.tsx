import { AddSupplierForm } from "../components/add-supplier-form";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        backHref="/suppliers"
        backLabel="Suppliers"
        title="Add Supplier"
        description="Create a new supplier for purchasing and invoicing."
      />
      <AddSupplierForm />
    </div>
  );
}
