import { DetailPageHeader } from "@/components/detail-page-header";

import { AddProductForm } from "../components/add-product-form";
import { ProductFormSidePanel } from "../components/product-form-side-panel";

export default function ProductsNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Product"
        description="Create a new product for your inventory catalog."
      />
      {/* Mirrors the customer + supplier new-page layout: form left,
          sticky "Why we ask" explainer right. Single-column on small
          screens; side-by-side from lg upward. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AddProductForm stickyFooter />
        <ProductFormSidePanel />
      </div>
    </div>
  );
}
