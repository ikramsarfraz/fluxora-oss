import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { isUuid } from "@/lib/utils/uuid";
import { getCategoryById } from "@/services/categories";

import { EditCategoryForm } from "../../components/edit-category-form";

export default async function EditCategoryRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const category = await getCategoryById(id);
  if (!category) notFound();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Edit category"
        description="Update category name and description."
      />
      <EditCategoryForm category={category} />
    </section>
  );
}
