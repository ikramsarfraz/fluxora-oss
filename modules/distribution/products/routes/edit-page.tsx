import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getProductById } from "../services/products";

import { AddProductForm } from "../components/add-product-form";
import { ProductFormSidePanel } from "../components/product-form-side-panel";

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
      {/* Mirrors the customer + supplier edit-page layout: form left,
          sticky "Why we ask" explainer right. Same grid template as the
          new page so the form widths stay visually consistent. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AddProductForm mode="edit" product={product} stickyFooter />
        <ProductFormSidePanel />
      </div>
    </section>
  );
}
