import Link from "next/link";

import { AddSupplierForm } from "../components/add-supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-supplier-heading">
        <AddSupplierForm />
      </section>
    </div>
  );
}
