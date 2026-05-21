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
import { captureException } from "@/lib/sentry-scope";

import { NewOrderForm } from "../components/new-order-form";

/**
 * Prefetch failures shouldn't block the page render — the client query
 * will retry on mount anyway — but they also shouldn't disappear into
 * the void. Tag with the query name so Sentry shows what fell over.
 */
function prefetchSafe(
  queryClient: QueryClient,
  label: string,
  query: Parameters<QueryClient["prefetchQuery"]>[0],
): Promise<void> {
  return queryClient.prefetchQuery(query).catch((e: unknown) => {
    captureException(e, { stage: "orders-new-prefetch", query: label });
  });
}

export default async function OrdersNewPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string | string[] }>;
}) {
  const { customerId } = await searchParams;
  const initialCustomerId = typeof customerId === "string" ? customerId : "";
  const queryClient = new QueryClient();

  const prefetches: Promise<unknown>[] = [
    prefetchSafe(queryClient, "customers.search", {
      queryKey: queryKeys.customers.search(""),
      queryFn: () => searchCustomers("", 20),
    }),
    prefetchSafe(queryClient, "products.all", {
      queryKey: queryKeys.products.all,
      queryFn: getProducts,
    }),
    prefetchSafe(queryClient, "inventory.casesOnHand", {
      queryKey: queryKeys.inventory.casesOnHand,
      queryFn: getProductCasesOnHand,
    }),
  ];

  // Deep-linked customer (?customerId=…): preload just that one so the
  // selected chip renders immediately instead of "Loading customer…".
  if (initialCustomerId) {
    prefetches.push(
      prefetchSafe(queryClient, "customers.detail", {
        queryKey: queryKeys.customers.detail(initialCustomerId),
        queryFn: () => getCustomerById(initialCustomerId),
      }),
    );
  }

  await Promise.all(prefetches);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewOrderForm initialCustomerId={initialCustomerId} />
    </HydrationBoundary>
  );
}
