import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { DetailPageHeader } from "@/components/detail-page-header";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getSupplierInvoiceById } from "@/services/receiving";

import { SupplierInvoiceEditShell } from "../../components/supplier-invoice-edit-shell";

export default async function SupplierInvoiceEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const invoice = await getSupplierInvoiceById(id);
  if (!invoice) notFound();
  if (invoice.status !== "draft") {
    redirect(`/supplier-invoices/${id}`);
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.supplierInvoices.detail(id), invoice);

  return (
    <section className="flex flex-col gap-6">
      <DetailPageHeader
        title={`Edit ${invoice.invoiceNumber}`}
        description="Update invoice details. Completing will auto-create lots and inventory."
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SupplierInvoiceEditShell invoiceId={id} />
      </HydrationBoundary>
    </section>
  );
}
