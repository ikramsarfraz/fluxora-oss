"use client";

import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { usePayments } from "@/hooks/use-payments";

import { paymentColumns } from "./columns";
import { DataTable } from "./data-table";

export function PaymentsPage() {
  const { data, isLoading, error, refetch } = usePayments();

  if (isLoading) {
    return <PageLoading message="Loading payments..." />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const payments = data ?? [];
  const hasPayments = payments.length > 0;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="payments-heading"
    >
      <PageHeader
        title="Payments"
        description="Customer payments recorded against sales invoices."
      />

      {hasPayments ? (
        <DataTable
          columns={paymentColumns}
          data={payments}
          searchPlaceholder="Search customer, invoice, reference..."
        />
      ) : (
        <EmptyState
          icon={Wallet}
          title="No payments yet"
          description="Record a payment from a sales invoice to see it here."
        />
      )}
    </section>
  );
}
