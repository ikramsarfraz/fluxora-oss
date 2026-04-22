import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getSupplierInvoices } from "@/services/receiving";

import SupplierInvoicesPage from "./components/supplier-invoices-page";

export default async function SupplierInvoicesRoute() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.supplierInvoices.all,
    queryFn: () => getSupplierInvoices(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SupplierInvoicesPage />
    </HydrationBoundary>
  );
}
