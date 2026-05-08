import { DetailPageHeader } from "@/components/detail-page-header";

import AddLotForm from "../components/add-lot-form";

export default function LotsNewPage() {
  return (
    <section className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Lot"
        description="Create a new lot for USDA traceability and inventory tracking."
      />
      <AddLotForm />
    </section>
  );
}
