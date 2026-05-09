import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getSupplierInvoiceById } from "../services/receiving";

import { SupplierInvoiceEditShell } from "../components/supplier-invoice-edit-shell";

export default async function SupplierInvoicesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) {
    redirect(`/supplier-invoices/${id}`);
  }

  const invoice = await getSupplierInvoiceById(id);
  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/supplier-invoices/${id}`);

  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.supplierInvoices.detail(id), invoice);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SupplierInvoiceEditShell invoiceId={id} />
    </HydrationBoundary>
  );
}
