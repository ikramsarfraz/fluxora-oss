import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getUnitsOfMeasure } from "../services/units-of-measure";

import UnitsOfMeasure from "../components/units-of-measure-page";

export default async function UnitsOfMeasureListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.unitsOfMeasure.all,
    queryFn: () => getUnitsOfMeasure(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UnitsOfMeasure />
    </HydrationBoundary>
  );
}
