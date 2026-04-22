"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import {
  useDeleteSupplierInvoice,
  useSupplierInvoices,
} from "@/hooks/use-supplier-invoices";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";

export default function SupplierInvoicesPage() {
  const { data, isLoading, error, refetch } = useSupplierInvoices();
  const deleteInvoice = useDeleteSupplierInvoice();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: invoice => {
          deleteInvoice.mutate(invoice.id, {
            onSuccess: () =>
              toast.success(
                `Draft invoice "${invoice.invoiceNumber}" deleted.`,
              ),
            onError: err =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Could not delete invoice.",
              ),
          });
        },
      }),
    [deleteInvoice],
  );

  if (isLoading) {
    return <PageLoading message="Loading supplier invoices..." />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const invoices = data ?? [];
  const hasInvoices = invoices.length > 0;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="supplier-invoices-heading"
    >
      <PageHeader
        title="Supplier invoices"
        description="Record incoming shipments. Completing an invoice automatically creates lots and inventory for traceability."
      >
        <Button asChild>
          <Link href="/supplier-invoices/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New invoice</span>
          </Link>
        </Button>
      </PageHeader>

      {hasInvoices ? (
        <DataTable columns={columns} data={invoices} />
      ) : (
        <EmptyState
          icon={FileText}
          title="No supplier invoices yet"
          description="Record your first supplier invoice to begin tracking inbound inventory."
        >
          <Button asChild>
            <Link href="/supplier-invoices/new">
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
