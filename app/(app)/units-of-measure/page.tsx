import UnitsOfMeasure from "./components/units-of-measure-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { getUnitsOfMeasure } from "@/services/units-of-measure";
import { queryKeys } from "@/lib/query/keys";

export default async function UnitsOfMeasurePage() {
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
