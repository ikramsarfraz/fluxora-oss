import Suppliers from "./components/suppliers-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { getSuppliers } from "@/services/suppliers";
import { queryKeys } from "@/lib/query/keys";

export default async function SuppliersPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: () => getSuppliers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suppliers />
    </HydrationBoundary>
  );
}
