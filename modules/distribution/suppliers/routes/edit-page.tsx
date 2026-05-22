import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/utils/uuid";
import { getSupplierById } from "../services/suppliers";

import { EditSupplierForm } from "../components/edit-supplier-form";
import { SupplierFormSidePanel } from "../components/supplier-form-side-panel";

export default async function SuppliersEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();
  if (supplier.archivedAt) notFound();

  return (
    <section className="flex flex-col gap-6">
      <BreadcrumbLabel href={`/suppliers/${supplier.id}`} label={supplier.name} />
      <PageHeader
        title="Edit supplier"
        description="Update supplier details and payment terms."
      >
        <Button variant="outline" asChild>
          <Link href={`/suppliers/${supplier.id}`}>
            <ArrowLeft className="size-4" />
            Back to supplier
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <EditSupplierForm supplier={supplier} />
        <SupplierFormSidePanel />
      </div>
    </section>
  );
}
