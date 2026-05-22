import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getCustomerById } from "../services/customers";

import { AddCustomerForm } from "../components/add-customer-form";
import { CustomerFormSidePanel } from "../components/customer-form-side-panel";

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
      <BreadcrumbLabel href={`/customers/${customer.id}`} label={customer.name} />
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AddCustomerForm mode="edit" customer={customer} stickyFooter />
        <CustomerFormSidePanel />
      </div>
    </section>
  );
}
