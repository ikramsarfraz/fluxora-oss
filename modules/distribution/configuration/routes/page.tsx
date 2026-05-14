import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getProductCategories } from "@/modules/distribution/products/services/products";
import { getUnitsOfMeasure } from "@/modules/distribution/units-of-measure/services/units-of-measure";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";

import ConfigurationTabs from "../components/configuration-tabs";

export default async function ConfigurationPage() {
  await requireAdminPortalUser();

  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.categories.all,
      queryFn: () => getProductCategories(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.unitsOfMeasure.all,
      queryFn: () => getUnitsOfMeasure(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <ConfigurationTabs />
      </Suspense>
    </HydrationBoundary>
  );
}
