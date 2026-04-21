"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { useDeleteSalesOrder, useSalesOrders } from "@/hooks/use-orders";
import type { SalesOrderListItem } from "@/services/orders";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";

export default function Orders() {
  const {
    data: orders,
    isLoading,
    error: loadError,
    refetch,
  } = useSalesOrders();
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
    return <PageLoading message="Loading orders..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasOrders = orders && orders.length > 0;

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
        <DataTable columns={columns} data={orders} />
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
