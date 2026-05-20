import { AddCustomerForm } from "../components/add-customer-form";
import { CustomerFormSidePanel } from "../components/customer-form-side-panel";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function CustomersNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Customer"
        description="Create a new customer record for sales orders and pricing."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AddCustomerForm stickyFooter />
        <CustomerFormSidePanel />
      </div>
    </div>
  );
}
