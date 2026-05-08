import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getLots } from "@/services/lots";
import { queryKeys } from "@/lib/query/keys";

import Lots from "../components/lots-page";

export default async function LotsListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.lots.all,
    queryFn: () => getLots(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Lots />
    </HydrationBoundary>
  );
}
