"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { ListingPage, StatusPill, MonoText, type ListingColumn } from "@/components/listing-page";
import { useSalesInvoicesPage } from "../hooks/use-invoices";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type { SalesInvoiceListItem, SalesInvoiceListSort } from "../services/invoicing";

type InvoiceRow = SalesInvoiceListItem;

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#f5f5f4", color: "#78716c" },
  sent: { label: "Sent", bg: "oklch(96% 0.03 240)", color: "oklch(60% 0.15 240)" },
  partially_paid: { label: "Partially paid", bg: "oklch(97% 0.04 70)", color: "oklch(60% 0.14 70)" },
  paid: { label: "Paid", bg: "oklch(96% 0.04 155)", color: "oklch(58% 0.13 155)" },
  void: { label: "Void", bg: "oklch(97% 0.04 25)", color: "oklch(55% 0.22 25)" },
};

const COLUMNS: ListingColumn<InvoiceRow>[] = [
  {
    key: "invoiceNumber",
    header: "Invoice #",
    sortKey: "invoiceNumber",
    width: "130px",
    render: row => ({
      primary: (
        <Link href={`/invoices/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.invoiceNumber}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "customer",
    header: "Customer",
    render: row => ({
      primary: row.customer
        ? <span style={{ fontWeight: 500 }}>{row.customer.name}</span>
        : <span style={{ color: "#78716c" }}>—</span>,
    }),
  },
  {
    key: "status",
    header: "Status",
    render: row => {
      const pill = STATUS_PILL[row.status] ?? { label: row.status, bg: "#f5f5f4", color: "#78716c" };
      return { primary: <StatusPill label={pill.label} bg={pill.bg} color={pill.color} /> };
    },
  },
  {
    key: "invoiceDate",
    header: "Invoice date",
    sortKey: "invoiceDate",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.invoiceDate)}</MonoText> }),
  },
  {
    key: "dueDate",
    header: "Due",
    render: row =>
      row.dueDate
        ? { primary: <MonoText>{formatDisplayDate(row.dueDate)}</MonoText> }
        : { primary: <span style={{ color: "#78716c" }}>—</span> },
  },
  {
    key: "totalAmount",
    header: "Total",
    align: "right",
    render: row => ({ primary: <MonoText>{formatMoney(row.totalAmount)}</MonoText> }),
  },
  {
    key: "balanceDue",
    header: "Balance due",
    align: "right",
    render: row => {
      const balance = Number(row.balanceDue);
      return {
        primary: (
          <span style={{ fontWeight: balance > 0 ? 500 : 400, color: balance > 0 ? "#0c0a09" : "#78716c" }}>
            <MonoText>{formatMoney(row.balanceDue)}</MonoText>
          </span>
        ),
      };
    },
  },
];

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

export default function Invoices() {
  const router = useRouter();

  const pagination = useUrlPaginationState<SalesInvoiceListSort>({
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useSalesInvoicesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

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
      title="Invoices"
      subtitle="Review customer invoices generated from fulfilled sales orders."
      columns={COLUMNS}
      getRowId={row => row.id}
      onRowClick={row => router.push(`/invoices/${row.id}`)}
      rowActions={[
        { label: "View", href: row => `/invoices/${row.id}` },
        { label: "View order", href: row => `/orders/${row.salesOrderId}` },
      ]}
      rows={data?.data ?? []}
      total={data?.total ?? 0}
      isLoading={isLoading}
      isFetching={isFetching}
      searchPlaceholder="Search invoices, customers…"
      emptyTitle="No invoices yet"
      emptyDescription="Invoices are generated when sales orders are fulfilled."
      page={data?.page ?? pagination.page}
      pageSize={data?.pageSize ?? pagination.pageSize}
      pageCount={data?.pageCount ?? 1}
      searchInput={pagination.searchInput}
      sort={pagination.sort}
      direction={pagination.direction}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      onSearchChange={pagination.setSearch}
      onSortChange={(key, dir) => pagination.setSort(key as SalesInvoiceListSort, dir)}
    />
  );
}
