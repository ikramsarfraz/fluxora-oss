import { AddProductForm } from "../components/add-product-form";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-product-heading">
        <AddProductForm />
      </section>
    </div>
  );
}
