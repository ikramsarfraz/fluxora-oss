import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import {
  getCustomerById,
  searchCustomers,
} from "@/modules/distribution/customers/services/customers";
import { getProducts } from "@/modules/distribution/products/services/products";
import { getProductCasesOnHand } from "@/modules/distribution/inventory/services/inventory";

import { NewOrderForm } from "../components/new-order-form";

export default async function OrdersNewPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string | string[] }>;
}) {
  const { customerId } = await searchParams;
  const initialCustomerId = typeof customerId === "string" ? customerId : "";
  const queryClient = new QueryClient();

  const prefetches: Promise<unknown>[] = [
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.customers.search(""),
        queryFn: () => searchCustomers("", 20),
      })
      .catch(() => {}),
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.products.all,
        queryFn: getProducts,
      })
      .catch(() => {}),
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.inventory.casesOnHand,
        queryFn: getProductCasesOnHand,
      })
      .catch(() => {}),
  ];

  // Deep-linked customer (?customerId=…): preload just that one so the
  // selected chip renders immediately instead of "Loading customer…".
  if (initialCustomerId) {
    prefetches.push(
      queryClient
        .prefetchQuery({
          queryKey: queryKeys.customers.detail(initialCustomerId),
          queryFn: () => getCustomerById(initialCustomerId),
        })
        .catch(() => {}),
    );
  }

  await Promise.all(prefetches);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewOrderForm initialCustomerId={initialCustomerId} />
    </HydrationBoundary>
  );
}
