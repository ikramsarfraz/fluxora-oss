"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useDeleteSupplier, useSuppliersPage } from "@/hooks/use-suppliers";
import type { SupplierListItem, SupplierListSort } from "@/services/suppliers";

export default function Suppliers() {
  const pagination = useUrlPaginationState<SupplierListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });
  const { data: suppliers, isLoading, isFetching, error: loadError, refetch } = useSuppliersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });
  const deleteSupplier = useDeleteSupplier();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: (supplier: SupplierListItem) => {
          deleteSupplier.mutate(supplier.id);
        },
      }),
    [deleteSupplier]
  );

  if (isLoading) {
    return <ListPageSkeleton tableColumns={5} />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasSuppliers =
    (suppliers?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="suppliers-heading">
      <PageHeader
        title="Suppliers"
        description="Add and manage suppliers for lots and supplier invoices."
      >
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Supplier</span>
          </Link>
        </Button>
      </PageHeader>

      {hasSuppliers ? (
        <DataTable
          columns={columns}
          data={suppliers?.data ?? []}
          searchPlaceholder="Search suppliers..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={suppliers?.page ?? pagination.page}
          pageSize={suppliers?.pageSize ?? pagination.pageSize}
          total={suppliers?.total ?? 0}
          pageCount={suppliers?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as SupplierListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Get started by adding your first supplier to the system."
        >
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="size-4" />
              Add Supplier
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
