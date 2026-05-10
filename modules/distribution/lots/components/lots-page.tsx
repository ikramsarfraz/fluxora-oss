"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ListingAction, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { ExpirationStateBadge, LotOperationalStatusBadge } from "@/modules/distribution/components/warehouse/warehouse-badges";
import { useLots } from "../hooks/use-lots";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatWeightLbs, getExpirationState, getLotOperationalStatus } from "@/lib/warehouse/insights";

import { getLotPrimaryProduct, getLotSourceInvoices, getLotTotals } from "./lot-view-helpers";

type LotRow = NonNullable<ReturnType<typeof useLots>["data"]>[number];

const COLUMNS: ListingColumn<LotRow>[] = [
  {
    key: "lotNumber",
    header: "Lot #",
    sortKey: "lot",
    width: "120px",
    render: row => ({
      primary: (
        <Link href={`/lots/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.lotNumber}</MonoText>
        </Link>
      ),
      secondary: row.supplier?.name,
    }),
  },
  {
    key: "product",
    header: "Product",
    sortKey: "product",
    render: row => {
      const product = getLotPrimaryProduct(row);
      const sourceInvoices = getLotSourceInvoices(row);
      return {
        primary: product
          ? <span style={{ fontWeight: 500 }}>{product.name}</span>
          : <span style={{ color: "#78716c" }}>—</span>,
        secondary: sourceInvoices[0]?.invoiceNumber,
      };
    },
  },
  {
    key: "receiveDate",
    header: "Received",
    sortKey: "receive",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.receiveDate)}</MonoText> }),
  },
  {
    key: "expiration",
    header: "Expiration",
    sortKey: "expiration",
    render: row => {
      const state = getExpirationState(row.expirationDate);
      return {
        primary: <ExpirationStateBadge state={state} />,
        secondary: formatDisplayDate(row.expirationDate),
      };
    },
  },
  {
    key: "items",
    header: "Items",
    sortKey: "items",
    align: "right",
    render: row => {
      const totals = getLotTotals(row);
      return { primary: <span style={{ color: "#44403c" }}>{totals.inventoryItemCount}</span> };
    },
  },
  {
    key: "weight",
    header: "Weight",
    sortKey: "weight",
    align: "right",
    render: row => {
      const totals = getLotTotals(row);
      return { primary: <MonoText>{formatWeightLbs(totals.totalWeight)}</MonoText> };
    },
  },
  {
    key: "status",
    header: "Status",
    sortKey: "status",
    render: row => {
      const totals = getLotTotals(row);
      const status = getLotOperationalStatus({
        inventoryStatuses: totals.statuses,
        expirationDate: row.expirationDate,
      });
      return { primary: <LotOperationalStatusBadge status={status} /> };
    },
  },
];

const PAGE_SIZE = 25;

export default function Lots() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("expiration");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useLots();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(lot => {
      if (!q) return true;
      const product = getLotPrimaryProduct(lot);
      const inv = getLotSourceInvoices(lot)[0];
      return [lot.lotNumber, lot.supplier?.name, product?.name, product?.sku, inv?.invoiceNumber]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(q));
    });
  }, [data, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const pa = getLotPrimaryProduct(a);
      const pb = getLotPrimaryProduct(b);
      const ta = getLotTotals(a);
      const tb = getLotTotals(b);
      let v = 0;
      if (sortKey === "lot") v = a.lotNumber.localeCompare(b.lotNumber);
      else if (sortKey === "supplier") v = (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "");
      else if (sortKey === "product") v = (pa?.name ?? "").localeCompare(pb?.name ?? "");
      else if (sortKey === "receive") v = a.receiveDate.localeCompare(b.receiveDate);
      else if (sortKey === "expiration") v = a.expirationDate.localeCompare(b.expirationDate);
      else if (sortKey === "items") v = ta.inventoryItemCount - tb.inventoryItemCount;
      else if (sortKey === "weight") v = ta.totalWeight - tb.totalWeight;
      return sortDir === "asc" ? v : -v;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (error) {
    return (
      <div style={{ padding: 24, color: "oklch(0.55 0.22 25)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button type="button" onClick={() => refetch()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <ListingPage
      title="Lots"
      subtitle="Inspect received stock, warehouse lifecycle, and lot traceability."
      primaryAction={
        <ListingAction href="/supplier-invoices/new">
          <Plus className="size-3.5" />
          Record bill
        </ListingAction>
      }
      columns={COLUMNS}
      getRowId={row => row.id}
      onRowClick={row => router.push(`/lots/${row.id}`)}
      rowActions={[{ label: "View", href: row => `/lots/${row.id}` }]}
      rows={pageRows}
      total={sorted.length}
      isLoading={isLoading}
      searchPlaceholder="Search lots, products, supplier, invoice…"
      emptyTitle="No lots yet"
      emptyDescription="Lots are created when supplier invoices are completed."
      page={safePage}
      pageSize={PAGE_SIZE}
      pageCount={pageCount}
      searchInput={search}
      sort={sortKey}
      direction={sortDir}
      onPageChange={p => { setPage(p); }}
      onPageSizeChange={() => {}}
      onSearchChange={q => { setSearch(q); setPage(1); }}
      onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); }}
    />
  );
}
