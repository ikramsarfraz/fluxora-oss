import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getSuppliers } from "@/services/suppliers";
import { queryKeys } from "@/lib/query/keys";

import Suppliers from "../components/suppliers-page";

export default async function SuppliersListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: () => getSuppliers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Suppliers />
      </Suspense>
    </HydrationBoundary>
  );
}
