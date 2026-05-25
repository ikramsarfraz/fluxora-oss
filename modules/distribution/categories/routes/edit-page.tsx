import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getCategoryById } from "../services/categories";

import { EditCategoryForm } from "../components/edit-category-form";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const category = await getCategoryById(id);
  if (!category) notFound();
  if (!category.isActive || category.archivedAt) notFound();

  return (
    <section className="flex flex-col gap-6">
      <BreadcrumbLabel href={`/categories/${category.id}`} label={category.name} />
      <PageHeader
        title="Edit category"
        description="Update category name and description."
      >
        <Button variant="outline" asChild>
          <Link href={`/categories/${category.id}`}>
            <ArrowLeft className="size-4" />
            Back to category
          </Link>
        </Button>
      </PageHeader>
      <EditCategoryForm category={category} />
    </section>
  );
}
