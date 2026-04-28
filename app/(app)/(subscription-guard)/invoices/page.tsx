import { Suspense } from "react";
import Invoices from "./components/invoices-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getSalesInvoices } from "@/services/invoicing";

export default async function InvoicesPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.invoices.all,
    queryFn: () => getSalesInvoices(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Invoices />
      </Suspense>
    </HydrationBoundary>
  );
}
