import Lots from "./components/lots-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getLots } from "@/services/lots";

export default async function LotsPage() {
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
