import { DetailPageHeader } from "@/components/detail-page-header";

import AddCategoryForm from "../components/add-category-form";

export default function AddCategoryPage() {
  return (
    <section className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Category"
        description="Create a new category for your inventory catalog."
      />
      <AddCategoryForm />
    </section>
  );
}
