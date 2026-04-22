import { AddLotForm } from "../components/add-lot-form";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Customer"
        description="Create a new customer record for sales orders and pricing."
      />
      <AddLotForm />
    </div>
  );
}
