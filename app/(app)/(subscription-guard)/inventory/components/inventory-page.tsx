"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpDown, PackageSearch } from "lucide-react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExpirationStateBadge,
  InventoryStatusBadge,
} from "@/components/warehouse/warehouse-badges";
import { useInventoryItemsPage } from "@/hooks/use-inventory";
import type { SortDirection } from "@/lib/pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatWeightLbs,
  getExpirationState,
  getInventoryStatusLabel,
} from "@/lib/warehouse/insights";
import type {
  InventoryListFilters,
  InventoryListSort,
  InventoryListItem,
} from "@/services/inventory";

const DEFAULT_INVENTORY_FILTERS: Required<InventoryListFilters> = {
  productId: "all",
  status: "all",
  lotId: "all",
  expiration: "all",
};

function getSourceInvoice(item: InventoryListItem) {
  return item.lot.lotReceipts[0]?.supplierInvoiceLine?.supplierInvoice ?? null;
}

function SortHeader({
  label,
  sortKey,
  activeSortKey,
  activeDirection,
  onSort,
}: {
  label: string;
  sortKey: InventoryListSort;
  activeSortKey: InventoryListSort;
  activeDirection: SortDirection;
  onSort: (sortKey: InventoryListSort) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="size-3.5" />
      {isActive ? (
        <span className="sr-only">
          Sorted {activeDirection === "asc" ? "ascending" : "descending"}
        </span>
      ) : null}
    </button>
  );
}

export function InventoryPage() {
  const pagination = useUrlPaginationState<
    InventoryListSort,
    Required<InventoryListFilters>
  >({
    defaultSort: "expiration",
    defaultDirection: "asc",
    defaultFilters: DEFAULT_INVENTORY_FILTERS,
  });
  const { data, isLoading, isFetching, error, refetch } = useInventoryItemsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: pagination.filters,
  });
  const paginationState = useMemo<PaginationState>(
    () => ({
      pageIndex: (data?.page ?? 1) - 1,
      pageSize: data?.pageSize ?? 10,
    }),
    [data],
  );
  const paginatedTable = useReactTable({
    data: data?.data ?? [],
    columns: [],
    state: { pagination: paginationState },
    onPaginationChange: updater => {
      const next =
        typeof updater === "function" ? updater(paginationState) : updater;
      if (next.pageSize !== pagination.pageSize) {
        pagination.setPageSize(next.pageSize);
        return;
      }
      pagination.setPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: data?.total ?? 0,
    pageCount: data?.pageCount ?? 1,
  });

  function handleSort(nextKey: InventoryListSort) {
    if (nextKey === pagination.sort) {
      pagination.setSort(
        nextKey,
        pagination.direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    pagination.setSort(nextKey, nextKey === "expiration" ? "asc" : "desc");
  }

  if (isLoading) {
    return <ListPageSkeleton metricCards={4} tableColumns={10} />;
  }

  if (error) {
    return (
      <PageError message={(error as Error).message} onRetry={() => refetch()} />
    );
  }

  const hasActiveFilter = Object.entries(pagination.filters).some(
    ([key, value]) =>
      value !==
      DEFAULT_INVENTORY_FILTERS[
        key as keyof typeof DEFAULT_INVENTORY_FILTERS
      ],
  );

  if (
    (data?.total ?? 0) === 0 &&
    !pagination.searchInput.trim() &&
    !hasActiveFilter
  ) {
    return (
      <section className="flex flex-col gap-6" aria-labelledby="inventory-heading">
        <PageHeader
          title="Inventory"
          description="Inspect received stock, warehouse lifecycle, and lot traceability."
        />
        <EmptyState
          icon={PackageSearch}
          title="No inventory yet"
          description="Completed supplier invoices will create inventory items here for warehouse inspection and traceability."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="inventory-heading">
      <PageHeader
        title="Inventory"
        description="Inspect stock, lot traceability, expiration risk, and outbound usage from one operational screen."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visible items
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.summary.totalItems ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total cases
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.summary.totalCases ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total weight
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {Number(data?.summary.totalWeight ?? 0).toFixed(2)} lb
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.summary.expiringCount ?? 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-lg">Stock inspection</CardTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={pagination.searchInput}
              onChange={event => pagination.setSearch(event.target.value)}
              placeholder="Search barcode, product, SKU, lot, supplier..."
              className="xl:col-span-2"
            />
            <Select
              value={pagination.filters.productId ?? "all"}
              onValueChange={value => {
                pagination.setFilter("productId", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {(data?.filterOptions.products ?? []).map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={pagination.filters.status ?? "all"}
              onValueChange={value => {
                pagination.setFilter(
                  "status",
                  value as Required<InventoryListFilters>["status"],
                );
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "in_stock",
                  "allocated",
                  "picked",
                  "packed",
                  "shipped",
                  "sold",
                  "damaged",
                  "expired",
                ].map(status => (
                  <SelectItem key={status} value={status}>
                    {getInventoryStatusLabel(status as InventoryListItem["status"])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={pagination.filters.lotId ?? "all"}
              onValueChange={value => {
                pagination.setFilter("lotId", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lots</SelectItem>
                {(data?.filterOptions.lots ?? []).map(lot => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {lot.lotNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "fresh", "expiring_soon", "expired"] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  pagination.setFilter("expiration", value);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  (pagination.filters.expiration ?? "all") === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {value === "all"
                  ? "All expiration"
                  : value === "expiring_soon"
                    ? "Expiring soon"
                    : value}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto rounded-md border">
            {isFetching ? (
              <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/50" />
              </div>
            ) : null}
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>
                    <SortHeader
                      label="Barcode / ID"
                      sortKey="barcode"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Product"
                      sortKey="product"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Lot"
                      sortKey="lot"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Cases"
                      sortKey="cases"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Weight lbs"
                      sortKey="weight"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Status"
                      sortKey="status"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Expiration"
                      sortKey="expiration"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Received"
                      sortKey="receive"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Supplier"
                      sortKey="supplier"
                      activeSortKey={pagination.sort}
                      activeDirection={pagination.direction}
                      onSort={handleSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={isFetching ? "opacity-60 transition-opacity" : undefined}>
                {(data?.data.length ?? 0) > 0 ? (
                  (data?.data ?? []).map(item => {
                    const expirationState = getExpirationState(
                      item.lot.expirationDate,
                    );
                    const sourceInvoice = getSourceInvoice(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link
                            href={`/inventory/${item.id}`}
                            className="font-medium hover:underline"
                          >
                            {item.barcodeId}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {item.id.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.product.name}</span>
                            {sourceInvoice ? (
                              <span className="text-xs text-muted-foreground">
                                From {sourceInvoice.invoiceNumber}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.product.sku}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/lots/${item.lot.id}`}
                            className="font-medium hover:underline"
                          >
                            {item.lot.lotNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.cases}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatWeightLbs(item.exactWeightLbs)}
                        </TableCell>
                        <TableCell>
                          <InventoryStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <ExpirationStateBadge state={expirationState} />
                            <span className="text-xs text-muted-foreground">
                              {formatDisplayDate(item.lot.expirationDate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDisplayDate(item.lot.receiveDate)}
                        </TableCell>
                        <TableCell>
                          {item.lot.supplier ? (
                            <span>{item.lot.supplier.name}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No inventory items match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <DataTablePagination
              table={paginatedTable}
              totalRows={data?.total ?? 0}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
