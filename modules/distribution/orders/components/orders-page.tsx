"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListingAction, ListingPage, StatusPill, MonoText, type ListingColumn } from "@/components/listing-page";
import { useDeleteSalesOrder, useSalesOrdersPage } from "../hooks/use-orders";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  SalesOrderListSort,
  SalesOrderListStatusFilter,
} from "../services/orders";

type OrderRow = NonNullable<ReturnType<typeof useSalesOrdersPage>["data"]>["data"][number];

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  sales_order: { label: "Draft", bg: "var(--color-divider)", color: "var(--color-subtle)" },
  confirmed: { label: "Awaiting fulfillment", bg: "var(--color-info-bg)", color: "var(--color-info-fg)" },
  fulfilled: { label: "Fulfilled", bg: "var(--color-success-bg)", color: "var(--color-success-fg)" },
  cancelled: { label: "Cancelled", bg: "var(--color-warning-bg)", color: "var(--color-warning-fg)" },
};

const COLUMNS: ListingColumn<OrderRow>[] = [
  {
    key: "orderNumber",
    header: "Order #",
    sortKey: "orderNumber",
    width: "130px",
    render: row => ({
      primary: (
        <Link href={`/orders/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.orderNumber ?? row.id.slice(0, 8)}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "customer",
    header: "Customer",
    render: row =>
      row.customer
        ? { primary: <span style={{ fontWeight: 500 }}>{row.customer.name}</span> }
        : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> },
  },
  {
    key: "orderDate",
    header: "Order date",
    sortKey: "orderDate",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.orderDate)}</MonoText> }),
  },
  {
    key: "dueDate",
    header: "Due",
    render: row =>
      row.dueDate
        ? { primary: <MonoText>{formatDisplayDate(row.dueDate)}</MonoText> }
        : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> },
  },
  {
    key: "status",
    header: "Status",
    sortKey: "status",
    render: row => {
      const pill = STATUS_PILL[row.status] ?? { label: row.status, bg: "var(--color-divider)", color: "var(--color-subtle)" };
      return { primary: <StatusPill label={pill.label} bg={pill.bg} color={pill.color} /> };
    },
  },
  {
    key: "lines",
    header: "Lines",
    align: "right",
    render: row => {
      const count = row.lines?.length ?? 0;
      return { primary: <span style={{ color: "var(--color-subtle)" }}>{count}</span> };
    },
  },
];

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "sales_order", label: "Drafts" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Orders() {
  const router = useRouter();
  const [deletingOrder, setDeletingOrder] = useState<OrderRow | null>(null);
  const [activeSegment, setActiveSegment] =
    useState<SalesOrderListStatusFilter>("all");

  const pagination = useUrlPaginationState<SalesOrderListSort>({
    defaultSort: "orderDate",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useSalesOrdersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: { status: activeSegment },
  });

  const deleteOrder = useDeleteSalesOrder();

  // Filtering moved server-side via `filters.status` above so segment +
  // pagination compose correctly (the previous client-only filter
  // hid rows that lived on other pages).
  const rows = data?.data ?? [];
  const hasInvoice = (order: OrderRow) => (order.invoices?.length ?? 0) > 0;

  if (error) {
    return (
      <div style={{ padding: 24, color: "var(--color-danger-fg)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button type="button" onClick={() => refetch()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <ListingPage
        title="Sales Orders"
        subtitle="Track sales orders, their status, and linked customers."
        primaryAction={
          <ListingAction href="/orders/new">
            <Plus className="size-3.5" />
            New order
          </ListingAction>
        }
        statusSegments={SEGMENTS}
        activeSegment={activeSegment}
        onSegmentChange={value =>
          setActiveSegment(value as SalesOrderListStatusFilter)
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/orders/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/orders/${row.id}` },
          {
            label: "Delete",
            variant: "destructive",
            isVisible: row => !hasInvoice(row),
            onClick: row => setDeletingOrder(row),
          },
        ]}
        rows={rows}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search orders, customers…"
        emptyTitle="No orders yet"
        emptyDescription="Create a sales order to get started."
        emptyAction={
          <ListingAction href="/orders/new">
            <Plus className="size-3.5" />
            New order
          </ListingAction>
        }
        page={data?.page ?? pagination.page}
        pageSize={data?.pageSize ?? pagination.pageSize}
        pageCount={data?.pageCount ?? 1}
        searchInput={pagination.searchInput}
        sort={pagination.sort}
        direction={pagination.direction}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        onSearchChange={pagination.setSearch}
        onSortChange={(key, dir) => pagination.setSort(key as SalesOrderListSort, dir)}
      />

      <AlertDialog open={!!deletingOrder} onOpenChange={open => { if (!open) setDeletingOrder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order</AlertDialogTitle>
            <AlertDialogDescription>
              Delete order{" "}
              <strong>{deletingOrder?.orderNumber ?? deletingOrder?.id.slice(0, 8)}</strong>?
              This will release any allocated inventory back to stock and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => {
                if (!deletingOrder) return;
                deleteOrder.mutate(deletingOrder.id, {
                  onSuccess: () => toast.success("Order deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingOrder(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
