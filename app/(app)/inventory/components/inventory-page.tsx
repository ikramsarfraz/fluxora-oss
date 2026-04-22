"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpirationStateBadge, InventoryStatusBadge } from "@/components/warehouse/warehouse-badges";
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
import { useInventoryItems } from "@/hooks/use-inventory";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatWeightLbs,
  getExpirationState,
  getInventoryStatusLabel,
  sumNumericStrings,
} from "@/lib/warehouse/insights";
import type { InventoryListItem } from "@/services/inventory";

type SortKey =
  | "barcode"
  | "product"
  | "lot"
  | "cases"
  | "weight"
  | "status"
  | "expiration"
  | "receive"
  | "supplier";

type SortDirection = "asc" | "desc";

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
  sortKey: SortKey;
  activeSortKey: SortKey;
  activeDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
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
  const { data, isLoading, error, refetch } = useInventoryItems();
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lotFilter, setLotFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiration");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const items = data ?? [];

  const productOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items.map(item => [item.product.id, item.product]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const lotOptions = useMemo(
    () =>
      Array.from(new Map(items.map(item => [item.lot.id, item.lot])).values()).sort(
        (a, b) => a.lotNumber.localeCompare(b.lotNumber),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return items.filter(item => {
      const expirationState = getExpirationState(item.lot.expirationDate);
      const sourceInvoice = getSourceInvoice(item);
      const matchesSearch =
        searchValue.length === 0 ||
        [
          item.barcodeId,
          item.id,
          item.product.name,
          item.product.sku,
          item.lot.lotNumber,
          item.lot.supplier?.name,
          sourceInvoice?.invoiceNumber,
        ]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(searchValue));

      return (
        matchesSearch &&
        (productFilter === "all" || item.product.id === productFilter) &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (lotFilter === "all" || item.lot.id === lotFilter) &&
        (expirationFilter === "all" || expirationState === expirationFilter)
      );
    });
  }, [items, search, productFilter, statusFilter, lotFilter, expirationFilter]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      const expirationA = getExpirationState(a.lot.expirationDate);
      const expirationB = getExpirationState(b.lot.expirationDate);

      const value =
        sortKey === "barcode"
          ? a.barcodeId.localeCompare(b.barcodeId)
          : sortKey === "product"
            ? a.product.name.localeCompare(b.product.name)
            : sortKey === "lot"
              ? a.lot.lotNumber.localeCompare(b.lot.lotNumber)
              : sortKey === "cases"
                ? a.cases - b.cases
                : sortKey === "weight"
                  ? Number(a.exactWeightLbs) - Number(b.exactWeightLbs)
                  : sortKey === "status"
                    ? getInventoryStatusLabel(a.status).localeCompare(
                        getInventoryStatusLabel(b.status),
                      )
                    : sortKey === "receive"
                      ? a.lot.receiveDate.localeCompare(b.lot.receiveDate)
                      : sortKey === "supplier"
                        ? (a.lot.supplier?.name ?? "").localeCompare(
                            b.lot.supplier?.name ?? "",
                          )
                        : expirationA.localeCompare(expirationB) ||
                          a.lot.expirationDate.localeCompare(b.lot.expirationDate);

      return sortDirection === "asc" ? value : value * -1;
    });

    return list;
  }, [filteredItems, sortDirection, sortKey]);

  const summary = useMemo(() => {
    return {
      totalItems: filteredItems.length,
      totalCases: filteredItems.reduce((sum, item) => sum + item.cases, 0),
      totalWeight: sumNumericStrings(
        filteredItems.map(item => item.exactWeightLbs),
      ),
      expiringCount: filteredItems.filter(
        item => getExpirationState(item.lot.expirationDate) === "expiring_soon",
      ).length,
    };
  }, [filteredItems]);

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "expiration" ? "asc" : "desc");
  }

  if (isLoading) {
    return <PageLoading message="Loading inventory..." />;
  }

  if (error) {
    return (
      <PageError message={(error as Error).message} onRetry={() => refetch()} />
    );
  }

  if (items.length === 0) {
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
            {summary.totalItems}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total cases
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.totalCases}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total weight
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.totalWeight.toFixed(2)} lb
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.expiringCount}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-lg">Stock inspection</CardTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search barcode, product, SKU, lot, supplier..."
              className="xl:col-span-2"
            />
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {productOptions.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={lotFilter} onValueChange={setLotFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Lot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lots</SelectItem>
                {lotOptions.map(lot => (
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
                onClick={() => setExpirationFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  expirationFilter === value
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
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>
                    <SortHeader
                      label="Barcode / ID"
                      sortKey="barcode"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Product"
                      sortKey="product"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Lot"
                      sortKey="lot"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Cases"
                      sortKey="cases"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Weight lbs"
                      sortKey="weight"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Status"
                      sortKey="status"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Expiration"
                      sortKey="expiration"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Received"
                      sortKey="receive"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Supplier"
                      sortKey="supplier"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length > 0 ? (
                  sortedItems.map(item => {
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
        </CardContent>
      </Card>
    </section>
  );
}
