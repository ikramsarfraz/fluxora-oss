import Link from "next/link";

import { AddCustomerForm } from "../components/add-customer-form";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-customer-heading">
        <AddCustomerForm />
      </section>
    </div>
  );
}
