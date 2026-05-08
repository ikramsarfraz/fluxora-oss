import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getProductById } from "../services/products";

import { AddProductForm } from "../components/add-product-form";

export default async function ProductsEditPage({
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
      >
        <Button variant="outline" asChild>
          <Link href={`/products/${product.id}`}>
            <ArrowLeft className="size-4" />
            Back to product
          </Link>
        </Button>
      </PageHeader>
      <AddProductForm mode="edit" product={product} />
    </section>
  );
}
