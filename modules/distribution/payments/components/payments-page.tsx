"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { usePaymentsPage } from "../hooks/use-payments";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type { PaymentListItem, PaymentListSort } from "../services/payments";

type PaymentRow = PaymentListItem;

const METHOD_LABELS: Record<PaymentRow["paymentMethod"], string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

const COLUMNS: ListingColumn<PaymentRow>[] = [
  {
    key: "paymentDate",
    header: "Date",
    sortKey: "paymentDate",
    render: row => ({
      primary: (
        <Link href={`/payments/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{formatDisplayDate(row.paymentDate)}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "customer",
    header: "Customer",
    render: row => {
      const customer = row.salesInvoice?.customer;
      return customer
        ? { primary: <span style={{ fontWeight: 500 }}>{customer.name}</span> }
        : { primary: <span style={{ color: "#78716c" }}>—</span> };
    },
  },
  {
    key: "invoice",
    header: "Invoice",
    render: row => {
      const invoice = row.salesInvoice;
      return invoice
        ? {
            primary: (
              <Link href={`/invoices/${invoice.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
                <MonoText>{invoice.invoiceNumber}</MonoText>
              </Link>
            ),
          }
        : { primary: <span style={{ color: "#78716c" }}>—</span> };
    },
  },
  {
    key: "amount",
    header: "Amount",
    sortKey: "amount",
    align: "right",
    render: row => ({ primary: <MonoText>{formatMoney(row.amount)}</MonoText> }),
  },
  {
    key: "paymentMethod",
    header: "Method",
    render: row => ({
      primary: (
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 100,
            background: "#f5f5f4",
            color: "#44403c",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}
        </span>
      ),
    }),
  },
  {
    key: "reference",
    header: "Reference",
    render: row => {
      const ref = row.referenceNumber ?? row.checkNumber;
      return ref
        ? { primary: <MonoText>{ref}</MonoText> }
        : { primary: <span style={{ color: "#78716c" }}>—</span> };
    },
  },
  {
    key: "recordedBy",
    header: "Recorded by",
    render: row => ({
      primary: row.createdBy?.fullName ?? <span style={{ color: "#78716c" }}>—</span>,
    }),
  },
];

export function PaymentsPage() {
  const router = useRouter();

  const pagination = useUrlPaginationState<PaymentListSort>({
    defaultSort: "paymentDate",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = usePaymentsPage({
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
      title="Payments"
      subtitle="Customer payments recorded against sales invoices."
      columns={COLUMNS}
      getRowId={row => row.id}
      onRowClick={row => router.push(`/payments/${row.id}`)}
      rowActions={[{ label: "View", href: row => `/payments/${row.id}` }]}
      rows={data?.data ?? []}
      total={data?.total ?? 0}
      isLoading={isLoading}
      isFetching={isFetching}
      searchPlaceholder="Search customer, invoice, reference…"
      emptyTitle="No payments yet"
      emptyDescription="Payments appear here when recorded against sales invoices."
      page={data?.page ?? pagination.page}
      pageSize={data?.pageSize ?? pagination.pageSize}
      pageCount={data?.pageCount ?? 1}
      searchInput={pagination.searchInput}
      sort={pagination.sort}
      direction={pagination.direction}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      onSearchChange={pagination.setSearch}
      onSortChange={(key, dir) => pagination.setSort(key as PaymentListSort, dir)}
    />
  );
}
