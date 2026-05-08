import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getPaymentById } from "@/services/payments";

import { PaymentDetailPage } from "../components/payment-detail-page";

export default async function PaymentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => getPaymentById(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PaymentDetailPage paymentId={id} />
    </HydrationBoundary>
  );
}
