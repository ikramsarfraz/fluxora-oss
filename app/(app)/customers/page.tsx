import Customers from "./components/customers-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { getCustomers } from "@/services/customers";

export default async function CustomersPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Customers />
    </HydrationBoundary>
  );
}
