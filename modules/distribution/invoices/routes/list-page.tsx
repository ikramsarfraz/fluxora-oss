import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getSalesInvoices } from "../services/invoicing";
import { queryKeys } from "@/lib/query/keys";

import Invoices from "../components/invoices-page";

export default async function InvoicesListPage() {
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
