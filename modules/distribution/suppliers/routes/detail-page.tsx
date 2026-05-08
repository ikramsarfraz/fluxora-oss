import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getSupplierById, getSuppliers } from "@/services/suppliers";

import { SupplierDetailPage } from "../components/supplier-detail-page";

export default async function SuppliersDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.suppliers.detail(id),
      queryFn: () => getSupplierById(id),
    });
  } catch {
    notFound();
  }

  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.suppliers.all,
      queryFn: getSuppliers,
    })
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SupplierDetailPage supplierId={id} />
    </HydrationBoundary>
  );
}
