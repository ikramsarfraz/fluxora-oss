import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getSalesInvoiceById } from "../services/invoicing";
import { getCurrentTenantCached } from "@/services/tenants";

import { InvoiceDetailPage } from "../components/invoice-detail-page";

export default async function InvoicesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [invoice, tenant] = await Promise.all([
    getSalesInvoiceById(id),
    getCurrentTenantCached(),
  ]);

  if (!invoice) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.invoices.detail(id), invoice);

  const branding = {
    companyLegalName: tenant.branding?.companyLegalName ?? null,
    displayName: tenant.branding?.displayName ?? null,
    invoiceFooterText: tenant.branding?.invoiceFooterText ?? null,
    invoiceNotesDefault: tenant.branding?.invoiceNotesDefault ?? null,
  };

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InvoiceDetailPage invoiceId={id} tenantBranding={branding} />
    </HydrationBoundary>
  );
}
