"use client";

import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { usePaymentsPage } from "@/hooks/use-payments";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import type { PaymentListSort } from "@/services/payments";

import { paymentColumns } from "./columns";
import { DataTable } from "./data-table";

export function PaymentsPage() {
  const pagination = useUrlPaginationState<PaymentListSort>({
    defaultSort: "paymentDate",
    defaultDirection: "desc",
  });
  const { data, isLoading, isFetching, error, refetch } = usePaymentsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  if (isLoading) {
    return <ListPageSkeleton tableColumns={6} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const payments = data?.data ?? [];
  const hasPayments =
    (data?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

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
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={data?.page ?? pagination.page}
          pageSize={data?.pageSize ?? pagination.pageSize}
          total={data?.total ?? 0}
          pageCount={data?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as PaymentListSort, nextDirection);
          }}
          isFetching={isFetching}
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
