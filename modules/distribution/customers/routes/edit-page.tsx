import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getCustomerById } from "../services/customers";

import { AddCustomerForm } from "../components/add-customer-form";

export default async function CustomersEditPage({
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
      >
        <Button variant="outline" asChild>
          <Link href={`/customers/${customer.id}`}>
            <ArrowLeft className="size-4" />
            Back to customer
          </Link>
        </Button>
      </PageHeader>
      <AddCustomerForm mode="edit" customer={customer} />
    </section>
  );
}
