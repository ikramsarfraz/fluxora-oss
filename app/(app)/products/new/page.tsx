import { AddProductForm } from "../components/add-product-form";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        backHref="/products"
        backLabel="Products"
        title="Add Product"
        description="Create a new product for your inventory catalog."
      />
      <AddProductForm />
    </div>
  );
}
