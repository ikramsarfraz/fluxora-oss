import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getInventoryItems } from "@/services/inventory";

import { InventoryPage } from "./components/inventory-page";

export default async function InventoryRoute() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.inventory.all,
    queryFn: getInventoryItems,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <InventoryPage />
      </Suspense>
    </HydrationBoundary>
  );
}
