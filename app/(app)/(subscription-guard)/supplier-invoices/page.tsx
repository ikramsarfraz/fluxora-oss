import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/query/keys";
import { getCurrentPortalUser } from "@/services/portal-users";
import { getSupplierInvoices } from "@/services/receiving";

import SupplierInvoicesPage from "./components/supplier-invoices-page";

export default async function SupplierInvoicesRoute() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) {
    notFound();
  }

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.supplierInvoices.all,
    queryFn: () => getSupplierInvoices(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <SupplierInvoicesPage />
      </Suspense>
    </HydrationBoundary>
  );
}
