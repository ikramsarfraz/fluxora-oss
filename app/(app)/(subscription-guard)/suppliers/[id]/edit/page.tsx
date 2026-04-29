import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { isUuid } from "@/lib/utils/uuid";
import { getSupplierById } from "@/services/suppliers";

import { EditSupplierForm } from "../../components/edit-supplier-form";

export default async function EditSupplierRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Edit supplier"
        description="Update supplier details and payment terms."
      />
      <EditSupplierForm supplier={supplier} />
    </section>
  );
}
