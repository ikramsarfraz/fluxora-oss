import { DetailPageHeader } from "@/components/detail-page-header";

import { AddProductForm } from "../components/add-product-form";

export default function ProductsNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Add Product"
        description="Create a new product for your inventory catalog."
      />
      <AddProductForm />
    </div>
  );
}
