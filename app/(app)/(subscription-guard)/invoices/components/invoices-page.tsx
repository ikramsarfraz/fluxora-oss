"use client";

import { useMemo } from "react";

import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import type { SalesInvoiceListSort } from "@/services/invoicing";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useSalesInvoicesPage } from "@/hooks/use-invoices";

export default function Invoices() {
  const pagination = useUrlPaginationState<SalesInvoiceListSort>({
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
  });
  const {
    data: invoices,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useSalesInvoicesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const columns = useMemo(() => createColumns(), []);

  if (isLoading) {
    return <ListPageSkeleton tableColumns={6} />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasInvoices =
    (invoices?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="invoices-heading">
      <PageHeader
        title="Invoices"
        description="Review customer invoices generated from fulfilled sales orders."
      />

      {hasInvoices ? (
        <DataTable
          columns={columns}
          data={invoices?.data ?? []}
          searchPlaceholder="Search invoices..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={invoices?.page ?? pagination.page}
          pageSize={invoices?.pageSize ?? pagination.pageSize}
          total={invoices?.total ?? 0}
          pageCount={invoices?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as SalesInvoiceListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
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
