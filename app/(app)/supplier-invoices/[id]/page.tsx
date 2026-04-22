import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getSupplierInvoiceById } from "@/services/receiving";

import { SupplierInvoiceDetailPage } from "../components/supplier-invoice-detail-page";

export default async function SupplierInvoiceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.supplierInvoices.detail(id),
      queryFn: () => getSupplierInvoiceById(id),
    });
  } catch {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SupplierInvoiceDetailPage invoiceId={id} />
    </HydrationBoundary>
  );
}
