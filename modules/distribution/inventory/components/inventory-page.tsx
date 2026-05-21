"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ListingAction, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import {
  ExpirationStateBadge,
  InventoryStatusBadge,
} from "@/modules/distribution/components/warehouse/warehouse-badges";
import { Plus } from "lucide-react";
import { useInventoryItemsPage } from "../hooks/use-inventory";
import { InventoryProductSummary } from "./inventory-product-summary";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatInventoryQuantity,
  getExpirationState,
  getInventoryStatusLabel,
} from "../utils/insights";
import type {
  InventoryListFilters,
  InventoryListItem,
  InventoryListSort,
} from "../services/inventory";

type InventoryRow = InventoryListItem;

const DEFAULT_FILTERS: Required<InventoryListFilters> = {
  productId: "all",
  status: "all",
  lotId: "all",
  expiration: "all",
};

const INVENTORY_STATUSES = [
  "in_stock", "allocated", "picked", "packed", "shipped", "sold", "damaged", "expired",
] as const;

function getSourceInvoice(item: InventoryRow) {
  return item.lot.lotReceipts[0]?.supplierInvoiceLine?.supplierInvoice ?? null;
}

const COLUMNS: ListingColumn<InventoryRow>[] = [
  {
    key: "barcode",
    header: "Barcode / ID",
    sortKey: "barcode",
    render: row => ({
      primary: (
        <Link href={`/inventory/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.barcodeId}</MonoText>
        </Link>
      ),
      secondary: row.id.slice(0, 8),
    }),
  },
  {
    key: "product",
    header: "Product",
    sortKey: "product",
    render: row => {
      const inv = getSourceInvoice(row);
      return {
        primary: <span style={{ fontWeight: 500 }}>{row.product.name}</span>,
        secondary: inv ? `From ${inv.invoiceNumber}` : undefined,
      };
    },
  },
  {
    key: "sku",
    header: "SKU",
    render: row => ({ primary: <MonoText>{row.product.sku}</MonoText> }),
  },
  {
    key: "lot",
    header: "Lot",
    sortKey: "lot",
    render: row => ({
      primary: (
        <Link href={`/inventory/lots/${row.lot.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.lot.lotNumber}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "weight",
    // Renamed from "Weight (lb)" — non-weight items (beverages, cans)
    // render their count in the product's base UOM instead. Sort key
    // stays "weight" since the underlying SQL still orders by
    // exact_weight_lbs (zero for non-weight items, which lumps them
    // together at the bottom — acceptable for now).
    header: "Quantity",
    sortKey: "weight",
    align: "right",
    render: row => ({
      primary: (
        <MonoText>
          {formatInventoryQuantity({
            costUnitTypeSnapshot: row.costUnitTypeSnapshot,
            exactWeightLbs: row.exactWeightLbs,
            cases: row.cases,
            baseUnitAbbreviation: row.product?.baseUnit?.abbreviation,
          })}
        </MonoText>
      ),
    }),
  },
  {
    key: "status",
    header: "Status",
    sortKey: "status",
    render: row => ({ primary: <InventoryStatusBadge status={row.status} /> }),
  },
  {
    key: "expiration",
    header: "Expiration",
    sortKey: "expiration",
    render: row => {
      const state = getExpirationState(row.lot.expirationDate);
      return {
        primary: <ExpirationStateBadge state={state} />,
        secondary: formatDisplayDate(row.lot.expirationDate),
      };
    },
  },
  {
    key: "received",
    header: "Received",
    sortKey: "receive",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.lot.receiveDate)}</MonoText> }),
  },
  {
    key: "supplier",
    header: "Supplier",
    sortKey: "supplier",
    render: row =>
      row.lot.supplier
        ? { primary: row.lot.supplier.name }
        : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> },
  },
];

const EXPIRATION_SEGMENTS = [
  { value: "all", label: "All" },
  { value: "fresh", label: "Fresh" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
];

export function InventoryPage() {
  const router = useRouter();

  const pagination = useUrlPaginationState<InventoryListSort, Required<InventoryListFilters>>({
    defaultSort: "expiration",
    defaultDirection: "desc",
    defaultFilters: DEFAULT_FILTERS,
  });

  const { data, isLoading, isFetching, error, refetch } = useInventoryItemsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    filters: pagination.filters,
  });

  const summary = data?.summary;

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
    <ListingPage
      title="Inventory"
      subtitle="Inspect stock, lot traceability, expiration risk, and outbound usage."
      primaryAction={
        <ListingAction href="/supplier-invoices/new">
          <Plus className="size-3.5" />
          Record bill
        </ListingAction>
      }
      kpis={summary ? [
        { label: "Items", value: summary.totalItems },
        { label: "Weight (lb)", value: Number(summary.totalWeight ?? 0).toFixed(0) },
        { label: "Expiring soon", value: summary.expiringCount },
      ] : undefined}
      headerExtra={<InventoryProductSummary />}
      statusSegments={EXPIRATION_SEGMENTS}
      activeSegment={pagination.filters.expiration ?? "all"}
      onSegmentChange={value => pagination.setFilter("expiration", value as Required<InventoryListFilters>["expiration"])}
      columns={COLUMNS}
      getRowId={row => row.id}
      onRowClick={row => router.push(`/inventory/${row.id}`)}
      rowActions={[{ label: "View", href: row => `/inventory/${row.id}` }]}
      rows={data?.data ?? []}
      total={data?.total ?? 0}
      isLoading={isLoading}
      isFetching={isFetching}
      searchPlaceholder="Search barcode, product, SKU, lot, supplier…"
      emptyTitle="No inventory yet"
      emptyDescription="Completed supplier invoices will create inventory items here."
      page={data?.page ?? pagination.page}
      pageSize={data?.pageSize ?? pagination.pageSize}
      pageCount={data?.pageCount ?? 1}
      searchInput={pagination.searchInput}
      sort={pagination.sort}
      direction={pagination.direction}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      onSearchChange={pagination.setSearch}
      onSortChange={(key, dir) => pagination.setSort(key as InventoryListSort, dir)}
    />
  );
}
