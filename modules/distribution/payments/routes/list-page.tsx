import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getPayments } from "../services/payments";

import { PaymentsPage } from "../components/payments-page";

export default async function PaymentsListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.payments.all,
    queryFn: () => getPayments(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <PaymentsPage />
      </Suspense>
    </HydrationBoundary>
  );
}
