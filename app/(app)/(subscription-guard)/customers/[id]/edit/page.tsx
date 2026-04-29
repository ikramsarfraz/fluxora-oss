import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { isUuid } from "@/lib/utils/uuid";
import { getCustomerById } from "@/services/customers";

import { AddCustomerForm } from "../../components/add-customer-form";

export default async function EditCustomerRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Edit customer"
        description="Update customer details, billing fields, and addresses."
      />
      <AddCustomerForm mode="edit" customer={customer} />
    </section>
  );
}
