import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getCustomers } from "@/services/customers";
import { getProducts } from "@/services/products";

import { NewOrderForm } from "../components/new-order-form";

export default async function OrdersNewPage() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.customers.all,
        queryFn: getCustomers,
      })
      .catch(() => {}),
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.products.all,
        queryFn: getProducts,
      })
      .catch(() => {}),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewOrderForm />
    </HydrationBoundary>
  );
}
