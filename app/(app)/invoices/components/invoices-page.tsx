"use client";

import { useMemo } from "react";

import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useSalesInvoices } from "@/hooks/use-invoices";

export default function Invoices() {
  const {
    data: invoices,
    isLoading,
    error: loadError,
    refetch,
  } = useSalesInvoices();

  const columns = useMemo(() => createColumns(), []);

  if (isLoading) {
    return <PageLoading message="Loading invoices..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasInvoices = invoices && invoices.length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="invoices-heading">
      <PageHeader
        title="Invoices"
        description="Review customer invoices generated from fulfilled sales orders."
      />

      {hasInvoices ? (
        <DataTable columns={columns} data={invoices} />
      ) : (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Invoices appear here once a sales order has been fully fulfilled or short shipped."
        />
      )}
    </section>
  );
}
