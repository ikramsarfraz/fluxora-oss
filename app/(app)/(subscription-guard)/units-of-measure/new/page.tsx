import { DetailPageHeader } from "@/components/detail-page-header";
import AddUnitForm from "../components/add-unit-form";

export default function AddUnitOfMeasurePage() {
  return (
    <section className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Unit of Measure"
        description="Create a new unit for inventory, purchasing, and sales tracking."
      />
      <AddUnitForm />
    </section>
  );
}
