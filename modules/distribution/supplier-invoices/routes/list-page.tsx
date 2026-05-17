import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/query/keys";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { listPendingBulkImportFiles } from "../services/bulk-import-history";
import { getSupplierInvoices } from "../services/receiving";

import { SupplierBillsShell } from "../components/supplier-bills-shell";

const INBOX_QUERY_KEY = ["bulk-import-files", "pending"] as const;

/**
 * `/supplier-invoices` — the tabbed shell that hosts the Inbox (pending
 * bulk-import rows) and Bills (posted supplier invoices) views.
 *
 * Prefetches BOTH queries server-side so tab-switching is instant. They're
 * small (one page of bills, the full pending inbox) and run in parallel.
 * Permission check covers both tabs because the same role gates both
 * underlying lists today.
 */
export default async function SupplierInvoicesListPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();

  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.supplierInvoices.all,
      queryFn: () => getSupplierInvoices(),
    }),
    queryClient.prefetchQuery({
      queryKey: INBOX_QUERY_KEY,
      queryFn: () => listPendingBulkImportFiles(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <SupplierBillsShell />
      </Suspense>
    </HydrationBoundary>
  );
}
