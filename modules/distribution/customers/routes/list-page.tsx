import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getCustomers } from "@/services/customers";

import Customers from "../components/customers-page";

export default async function CustomersListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Customers />
      </Suspense>
    </HydrationBoundary>
  );
}
