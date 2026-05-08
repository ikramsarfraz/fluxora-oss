import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getSalesOrders } from "@/services/orders";
import { queryKeys } from "@/lib/query/keys";

import Orders from "../components/orders-page";

export default async function OrdersListPage() {
  const queryClient = new QueryClient();

  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.salesOrders.all,
      queryFn: getSalesOrders,
    })
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Orders />
      </Suspense>
    </HydrationBoundary>
  );
}
