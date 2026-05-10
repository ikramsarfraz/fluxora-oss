import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getCustomers } from "@/modules/distribution/customers/services/customers";
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
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.inventory.casesOnHand,
        queryFn: getProductCasesOnHand,
      })
      .catch(() => {}),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewOrderForm initialCustomerId={initialCustomerId} />
    </HydrationBoundary>
  );
}
