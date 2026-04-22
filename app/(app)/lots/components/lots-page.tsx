"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Layers, Plus } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { ExpirationStateBadge, LotOperationalStatusBadge } from "@/components/warehouse/warehouse-badges";
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
import { useLots } from "@/hooks/use-lots";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatWeightLbs,
  getExpirationState,
  getLotOperationalStatus,
  getLotOperationalStatusLabel,
  type LotOperationalStatus,
} from "@/lib/warehouse/insights";

import {
  getLotPrimaryProduct,
  getLotSourceInvoices,
  getLotTotals,
} from "./lot-view-helpers";

type SortKey =
  | "lot"
  | "supplier"
  | "product"
  | "receive"
  | "expiration"
  | "items"
  | "cases"
  | "weight"
  | "status";

type SortDirection = "asc" | "desc";

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
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
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

export default function Lots() {
  const { data, isLoading, error: loadError, refetch } = useLots();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [lotStatusFilter, setLotStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiration");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const lots = data ?? [];

  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Map(
          lots
            .filter(lot => lot.supplier)
            .map(lot => [lot.supplier!.id, lot.supplier!]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [lots],
  );

  const productOptions = useMemo(
    () =>
      Array.from(
        new Map(
          lots
            .map(getLotPrimaryProduct)
            .filter(Boolean)
            .map(product => [product!.id, product!]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [lots],
  );

  const lotStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          lots.map(lot =>
            getLotOperationalStatus({
              inventoryStatuses: getLotTotals(lot).statuses,
              expirationDate: lot.expirationDate,
            }),
          ),
        ),
      )
        .sort((a, b) =>
          getLotOperationalStatusLabel(a).localeCompare(
            getLotOperationalStatusLabel(b),
          ),
        ) as LotOperationalStatus[],
    [lots],
  );

  const filteredLots = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return lots.filter(lot => {
      const product = getLotPrimaryProduct(lot);
      const sourceInvoice = getLotSourceInvoices(lot)[0] ?? null;
      const expirationState = getExpirationState(lot.expirationDate);
      const lotStatus = getLotOperationalStatus({
        inventoryStatuses: getLotTotals(lot).statuses,
        expirationDate: lot.expirationDate,
      });
      const matchesSearch =
        searchValue.length === 0 ||
        [
          lot.lotNumber,
          lot.supplier?.name,
          product?.name,
          product?.sku,
          sourceInvoice?.invoiceNumber,
        ]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(searchValue));

      return (
        matchesSearch &&
        (supplierFilter === "all" || lot.supplierId === supplierFilter) &&
        (productFilter === "all" || product?.id === productFilter) &&
        (expirationFilter === "all" || expirationState === expirationFilter) &&
        (lotStatusFilter === "all" || lotStatus === lotStatusFilter)
      );
    });
  }, [
    lots,
    search,
    supplierFilter,
    productFilter,
    expirationFilter,
    lotStatusFilter,
  ]);

  const sortedLots = useMemo(() => {
    const list = [...filteredLots];

    list.sort((a, b) => {
      const productA = getLotPrimaryProduct(a);
      const productB = getLotPrimaryProduct(b);
      const totalsA = getLotTotals(a);
      const totalsB = getLotTotals(b);
      const statusA = getLotOperationalStatus({
        inventoryStatuses: totalsA.statuses,
        expirationDate: a.expirationDate,
      });
      const statusB = getLotOperationalStatus({
        inventoryStatuses: totalsB.statuses,
        expirationDate: b.expirationDate,
      });

      const value =
        sortKey === "lot"
          ? a.lotNumber.localeCompare(b.lotNumber)
          : sortKey === "supplier"
            ? (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "")
            : sortKey === "product"
              ? (productA?.name ?? "").localeCompare(productB?.name ?? "")
              : sortKey === "receive"
                ? a.receiveDate.localeCompare(b.receiveDate)
                : sortKey === "expiration"
                  ? a.expirationDate.localeCompare(b.expirationDate)
                  : sortKey === "items"
                    ? totalsA.inventoryItemCount - totalsB.inventoryItemCount
                    : sortKey === "cases"
                      ? totalsA.totalCases - totalsB.totalCases
                      : sortKey === "weight"
                        ? totalsA.totalWeight - totalsB.totalWeight
                        : statusA.localeCompare(statusB);

      return sortDirection === "asc" ? value : value * -1;
    });

    return list;
  }, [filteredLots, sortDirection, sortKey]);

  const summary = useMemo(() => {
    return {
      totalLots: filteredLots.length,
      totalItems: filteredLots.reduce(
        (sum, lot) => sum + getLotTotals(lot).inventoryItemCount,
        0,
      ),
      totalWeight: filteredLots.reduce(
        (sum, lot) => sum + getLotTotals(lot).totalWeight,
        0,
      ),
      expiringSoon: filteredLots.filter(
        lot => getExpirationState(lot.expirationDate) === "expiring_soon",
      ).length,
    };
  }, [filteredLots]);

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "expiration" ? "asc" : "desc");
  }

  if (isLoading) {
    return <PageLoading message="Loading lots..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  if (lots.length === 0) {
    return (
      <section className="flex flex-col gap-6" aria-labelledby="lots-heading">
        <PageHeader
          title="Lots"
          description="Trace inbound lots, linked inventory, and expiration exposure."
        >
          <Button asChild>
            <Link href="/lots/new">
              <Plus className="size-4" />
              Add lot
            </Link>
          </Button>
        </PageHeader>
        <EmptyState
          icon={Layers}
          title="No lots yet"
          description="Completed supplier invoices will begin building your traceability history here."
        >
          <Button asChild>
            <Link href="/lots/new">
              <Plus className="size-4" />
              Add lot
            </Link>
          </Button>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="lots-heading">
      <PageHeader
        title="Lots"
        description="Inspect lot traceability, linked inventory, source receipts, and expiration risk."
      >
        <Button asChild>
          <Link href="/lots/new">
            <Plus className="size-4" />
            Add lot
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visible lots
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.totalLots}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inventory items
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.totalItems}
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
            {summary.expiringSoon}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-lg">Lot inspection</CardTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search lot, supplier, product, invoice..."
              className="xl:col-span-2"
            />
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {supplierOptions.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={lotStatusFilter} onValueChange={setLotStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Lot status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lot statuses</SelectItem>
                {lotStatusOptions.map(status => (
                  <SelectItem key={status} value={status}>
                    {getLotOperationalStatusLabel(status)}
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
                      label="Lot number"
                      sortKey="lot"
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
                  <TableHead>
                    <SortHeader
                      label="Product"
                      sortKey="product"
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
                      label="Expiration"
                      sortKey="expiration"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Items"
                      sortKey="items"
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
                      label="Status summary"
                      sortKey="status"
                      activeSortKey={sortKey}
                      activeDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLots.length > 0 ? (
                  sortedLots.map(lot => {
                    const product = getLotPrimaryProduct(lot);
                    const totals = getLotTotals(lot);
                    const sourceInvoice = getLotSourceInvoices(lot)[0] ?? null;
                    const expirationState = getExpirationState(lot.expirationDate);
                    const lotStatus = getLotOperationalStatus({
                      inventoryStatuses: totals.statuses,
                      expirationDate: lot.expirationDate,
                    });

                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <Link
                            href={`/lots/${lot.id}`}
                            className="font-medium hover:underline"
                          >
                            {lot.lotNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{lot.supplier?.name ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{product?.name ?? "Unknown product"}</span>
                            {product?.sku ? (
                              <span className="font-mono text-xs text-muted-foreground">
                                {product.sku}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDisplayDate(lot.receiveDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <ExpirationStateBadge state={expirationState} />
                            <span className="text-xs text-muted-foreground">
                              {formatDisplayDate(lot.expirationDate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {totals.inventoryItemCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {totals.totalCases}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatWeightLbs(totals.totalWeight)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <LotOperationalStatusBadge status={lotStatus} />
                            {sourceInvoice ? (
                              <span className="text-xs text-muted-foreground">
                                {sourceInvoice.invoiceNumber}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No lots match the current filters.
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
