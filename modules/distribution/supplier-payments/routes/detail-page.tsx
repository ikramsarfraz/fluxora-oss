import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getBillPaymentById } from "../services/supplier-payments";

import { BillPaymentDetailPage } from "../components/bill-payment-detail-page";

export default async function BillPaymentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.billPayments.detail(id),
    queryFn: () => getBillPaymentById(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BillPaymentDetailPage paymentId={id} />
    </HydrationBoundary>
  );
}
