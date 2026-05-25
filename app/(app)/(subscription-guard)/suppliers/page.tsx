import { Suspense } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getSuppliers } from "@/modules/distribution/suppliers/services/suppliers";
import { queryKeys } from "@/lib/query/keys";
import Suppliers from "@/modules/distribution/suppliers/components/suppliers-page";

// `view=compare` (the Procurement Intelligence prototype) is hidden in V1 —
// too many dead CTAs and a deprecated promote-to-primary action that throws
// on click. The page component and service are intact for future iteration;
// see GH issue #160 for the V2 plan and the ViewSwitcher for the entry point
// to re-enable.
export default async function SuppliersPage() {
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
