import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { isUuid } from "@/lib/utils/uuid";
import { getProductById } from "@/services/products";

import { AddProductForm } from "../../components/add-product-form";

export default async function EditProductRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Edit product"
        description="Update product details, categories, and unit mappings."
      />
      <AddProductForm mode="edit" product={product} />
    </section>
  );
}
