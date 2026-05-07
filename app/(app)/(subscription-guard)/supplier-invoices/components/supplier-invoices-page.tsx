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
import { ListingPage, StatusPill, MonoText, type ListingColumn } from "@/components/listing-page";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import { useDeleteSupplierInvoice, useSupplierInvoicesPage } from "@/hooks/use-supplier-invoices";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { can } from "@/lib/auth/permissions";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type { SupplierInvoiceListItem, SupplierInvoiceListSort } from "@/services/receiving";

type InvoiceRow = SupplierInvoiceListItem;

const COLUMNS: ListingColumn<InvoiceRow>[] = [
  {
    key: "invoiceNumber",
    header: "Invoice #",
    sortKey: "invoiceNumber",
    width: "140px",
    render: row => ({
      primary: (
        <Link href={`/supplier-invoices/${row.id}`} style={{ textDecoration: "none", color: "inherit" }} onClick={e => e.stopPropagation()}>
          <MonoText>{row.invoiceNumber}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "supplier",
    header: "Supplier",
    render: row => ({
      primary: row.supplier
        ? <span style={{ fontWeight: 500 }}>{row.supplier.name}</span>
        : <span style={{ color: "#78716c" }}>—</span>,
    }),
  },
  {
    key: "status",
    header: "Status",
    render: row => {
      if (row.status === "completed") {
        return { primary: <StatusPill label="Completed" bg="oklch(96% 0.04 155)" color="oklch(58% 0.13 155)" /> };
      }
      return { primary: <StatusPill label="Draft" bg="#f5f5f4" color="#78716c" /> };
    },
  },
  {
    key: "invoiceDate",
    header: "Invoice date",
    sortKey: "invoiceDate",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.invoiceDate)}</MonoText> }),
  },
  {
    key: "totalAmount",
    header: "Total",
    align: "right",
    sortKey: "totalAmount",
    render: row => ({ primary: <MonoText>{formatMoney(row.totalAmount)}</MonoText> }),
  },
];

export default function SupplierInvoicesPage() {
  const router = useRouter();
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null);

  const { data: currentUser } = useCurrentPortalUser();
  const canDelete = can(currentUser?.role ?? null, "delete_supplier_invoice");

  const pagination = useUrlPaginationState<SupplierInvoiceListSort>({
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useSupplierInvoicesPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const deleteInvoice = useDeleteSupplierInvoice();

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

  const rowActions = [
    { label: "View", href: (row: InvoiceRow) => `/supplier-invoices/${row.id}` },
    ...(canDelete
      ? [{
          label: "Delete draft",
          variant: "destructive" as const,
          onClick: (row: InvoiceRow) => {
            if (row.status !== "draft") {
              toast.error("Only draft invoices can be deleted.");
              return;
            }
            setDeletingInvoice(row);
          },
        }]
      : []),
  ];

  return (
    <>
      <ListingPage
        title="Supplier Invoices"
        subtitle="Manage receiving invoices and stock intake."
        primaryAction={
          <Link
            href="/supplier-invoices/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#0c0a09",
              color: "#fafaf9",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            New invoice
          </Link>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/supplier-invoices/${row.id}`)}
        rowActions={rowActions}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search invoices, suppliers…"
        emptyTitle="No supplier invoices yet"
        emptyDescription="Create a supplier invoice to start receiving inventory."
        emptyAction={
          <Link
            href="/supplier-invoices/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#0c0a09",
              color: "#fafaf9",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            New invoice
          </Link>
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
        onSortChange={(key, dir) => pagination.setSort(key as SupplierInvoiceListSort, dir)}
      />

      <AlertDialog open={!!deletingInvoice} onOpenChange={open => { if (!open) setDeletingInvoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Delete draft invoice <strong>{deletingInvoice?.invoiceNumber}</strong>? This removes all
              associated lines and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingInvoice) return;
                deleteInvoice.mutate(deletingInvoice.id, {
                  onSuccess: () => toast.success("Invoice deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingInvoice(null);
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
