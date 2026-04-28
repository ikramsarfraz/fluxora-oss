"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useDeleteSalesOrder, useSalesOrdersPage } from "@/hooks/use-orders";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import type { SalesOrderListItem, SalesOrderListSort } from "@/services/orders";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";

export default function Orders() {
  const pagination = useUrlPaginationState<SalesOrderListSort>({
    defaultSort: "orderDate",
    defaultDirection: "desc",
  });
  const {
    data: orders,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useSalesOrdersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });
  const deleteOrder = useDeleteSalesOrder();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: (order: SalesOrderListItem) => {
          deleteOrder.mutate(order.id);
        },
      }),
    [deleteOrder],
  );

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

  const hasOrders =
    (orders?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="orders-heading">
      <PageHeader
        title="Orders"
        description="Track sales orders, their status, and linked customers."
      >
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Order</span>
          </Link>
        </Button>
      </PageHeader>

      {hasOrders ? (
        <DataTable
          columns={columns}
          data={orders?.data ?? []}
          searchPlaceholder="Search orders..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={orders?.page ?? pagination.page}
          pageSize={orders?.pageSize ?? pagination.pageSize}
          total={orders?.total ?? 0}
          pageCount={orders?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as SalesOrderListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Create a sales order to get started."
        >
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="size-4" />
              New Order
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
