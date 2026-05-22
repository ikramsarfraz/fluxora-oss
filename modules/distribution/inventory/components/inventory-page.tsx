"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import {
  ListingAction,
  ListingErrorState,
  ListingPage,
  ListingSecondaryAction,
  MonoText,
  type ListingColumn,
} from "@/components/listing-page";
import {
  ExpirationStateBadge,
  InventoryStatusBadge,
} from "@/modules/distribution/components/warehouse/warehouse-badges";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Plus } from "lucide-react";
import { exportInventoryCsvAction } from "../actions";
import { useInventoryItemsPage } from "../hooks/use-inventory";
import { InventoryProductSummary } from "./inventory-product-summary";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatInventoryQuantity,
  getExpirationState,
  type InventoryLifecycleState,
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
  supplierId: "all",
  lotId: "all",
  lotNumber: "",
  expiration: "all",
};

// Filter-bar options. Order matches the typical operator mental model
// (active → outbound → end-of-life) rather than alphabetical.
const STATUS_FILTER_OPTIONS: { value: "all" | InventoryLifecycleState; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "in_stock", label: "In stock" },
  { value: "allocated", label: "Allocated" },
  { value: "picked", label: "Picked" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "sold", label: "Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
];

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
            // Pack size lives on the inventory row now — drives the
            // "120 ea (5 cs)" display for multi-pack rows.
            unitsPerPackageSnapshot: row.unitsPerPackageSnapshot,
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
  const [exporting, setExporting] = useState(false);

  const pagination = useUrlPaginationState<InventoryListSort, Required<InventoryListFilters>>({
    defaultSort: "expiration",
    defaultDirection: "desc",
    defaultFilters: DEFAULT_FILTERS,
  });

  // Export the same shape the user is looking at — same search + filters,
  // no pagination. The expiration segment is part of `pagination.filters`
  // too, so segment-narrowed views export only the relevant slice.
  async function handleExportCsv() {
    setExporting(true);
    try {
      const { filename, csv } = await exportInventoryCsvAction({
        search: pagination.search,
        filters: pagination.filters,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Inventory exported.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

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
      <ListingErrorState
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  // Has the user narrowed the list by anything other than the expiration
  // segment toggle (which is rendered separately by ListingPage)? Used to
  // toggle the "Clear filters" affordance + the empty-state copy.
  const hasNonSegmentFilters =
    (pagination.filters.status ?? "all") !== "all" ||
    (pagination.filters.supplierId ?? "all") !== "all" ||
    (pagination.filters.lotNumber ?? "").trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <InventoryFilterBar
        filters={pagination.filters}
        suppliers={data?.filterOptions.suppliers ?? []}
        onChangeStatus={value =>
          pagination.setFilter("status", value as Required<InventoryListFilters>["status"])
        }
        onChangeSupplier={value =>
          pagination.setFilter("supplierId", value)
        }
        onChangeLotNumber={value =>
          pagination.setFilter("lotNumber", value)
        }
        onClear={() =>
          pagination.setFilters({
            status: "all",
            supplierId: "all",
            lotNumber: "",
          })
        }
        anyActive={hasNonSegmentFilters}
      />
      <ListingPage
        title="Inventory"
        subtitle="Inspect stock, lot traceability, expiration risk, and outbound usage."
        secondaryActions={
          <ListingSecondaryAction
            onClick={handleExportCsv}
            disabled={exporting}
          >
            <Download className="size-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </ListingSecondaryAction>
        }
        primaryAction={
          <ListingAction href="/supplier-invoices/new">
            <Plus className="size-3.5" />
            Record bill
          </ListingAction>
        }
      kpis={summary ? (() => {
        const weight = Number(summary.totalWeight ?? 0);
        const units = Number(summary.totalUnits ?? 0);
        const kpis: { label: string; value: string | number }[] = [
          { label: "Items", value: summary.totalItems },
        ];
        // Show Weight only when the workspace actually carries weight-priced
        // stock; show Units only when it carries non-weight stock. Pure-meat
        // tenants see the legacy single-KPI layout; mixed catalogs get both.
        if (weight > 0 || units === 0) {
          kpis.push({ label: "Weight (lb)", value: weight.toFixed(0) });
        }
        if (units > 0) {
          kpis.push({ label: "Units", value: units.toLocaleString() });
        }
        kpis.push({ label: "Expiring soon", value: summary.expiringCount });
        return kpis;
      })() : undefined}
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
    </div>
  );
}

// Filter bar matches the peer pattern in payments/invoices/supplier-payments
// (FilterField + Select) — kept local rather than extracted because the
// codebase already has 3 copies and a fourth at this size isn't worth a
// new shared primitive. Track the consolidation separately.
function InventoryFilterBar({
  filters,
  suppliers,
  onChangeStatus,
  onChangeSupplier,
  onChangeLotNumber,
  onClear,
  anyActive,
}: {
  filters: Required<InventoryListFilters>;
  suppliers: { id: string; name: string }[];
  onChangeStatus: (value: string) => void;
  onChangeSupplier: (value: string) => void;
  onChangeLotNumber: (value: string) => void;
  onClear: () => void;
  anyActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-card px-3 py-2.5">
      <FilterField label="Status">
        <Select value={filters.status ?? "all"} onValueChange={onChangeStatus}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Supplier">
        <Select
          value={filters.supplierId ?? "all"}
          onValueChange={onChangeSupplier}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Lot #">
        <Input
          type="search"
          value={filters.lotNumber ?? ""}
          onChange={e => onChangeLotNumber(e.target.value)}
          placeholder="Search lot number…"
          className="h-8 w-[180px] text-xs"
        />
      </FilterField>

      {anyActive ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs font-medium text-subtle underline-offset-4 hover:text-ink hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-subtle">
      <span className="font-medium uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
