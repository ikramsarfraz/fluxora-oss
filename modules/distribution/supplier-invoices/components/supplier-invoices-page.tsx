"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Layers } from "lucide-react";
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
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useDeleteSupplierInvoice, useSupplierInvoicesPage } from "../hooks/use-supplier-invoices";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { can } from "@/lib/auth/permissions";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import type { SupplierInvoiceListItem, SupplierInvoiceListSort } from "../services/receiving";
import { getSupplierInvoiceStatusInfo } from "../utils/status";

type InvoiceRow = SupplierInvoiceListItem;

const COLUMNS: ListingColumn<InvoiceRow>[] = [
  {
    key: "referenceNumber",
    header: "Reference",
    sortKey: "referenceNumber",
    width: "140px",
    render: row => ({
      primary: (
        <Link
          href={`/supplier-invoices/${row.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
          onClick={e => e.stopPropagation()}
        >
          <MonoText>{row.referenceNumber}</MonoText>
        </Link>
      ),
    }),
  },
  {
    key: "invoiceNumber",
    header: "Supplier inv #",
    sortKey: "invoiceNumber",
    width: "140px",
    render: row => ({
      primary: row.invoiceNumber ? (
        <MonoText>{row.invoiceNumber}</MonoText>
      ) : (
        <span style={{ color: "var(--color-muted)" }}>—</span>
      ),
    }),
  },
  {
    key: "supplier",
    header: "Supplier",
    render: row => ({
      primary: row.supplier
        ? <span style={{ fontWeight: 500 }}>{row.supplier.name}</span>
        : <span style={{ color: "var(--color-subtle)" }}>—</span>,
    }),
  },
  {
    key: "status",
    header: "Status",
    render: row => {
      // Driven by the shared utils/status.ts mapping so this listing,
      // the legacy columns.tsx surface, and the detail page header pill
      // all read from one source. The old if/else here hard-coded
      // completed → "Received" with everything else falling through to
      // "Draft" — so "paid" / "posted" / "receiving" / "reconciled" /
      // "void" all rendered as Draft.
      const info = getSupplierInvoiceStatusInfo(row.status);
      const colors =
        info.tone === "success"
          ? { bg: "var(--color-success-bg)", color: "var(--color-success-fg)" }
          : info.tone === "info"
            ? { bg: "var(--color-info-bg)", color: "var(--color-info-fg)" }
            : info.tone === "default"
              ? { bg: "var(--color-success-bg)", color: "var(--color-success-fg)" }
              : { bg: "var(--color-divider)", color: "var(--color-subtle)" };
      return {
        primary: <StatusPill label={info.label} bg={colors.bg} color={colors.color} />,
      };
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

/**
 * Bills tab content for the supplier-invoices page.
 *
 * When `embedded` is true the component skips its own title/subtitle/actions
 * because the parent `SupplierBillsShell` owns those (tabs + Bulk import
 * sheet trigger + Record bill nav are shared chrome across tabs). Standalone
 * usage (no `embedded` prop) keeps the original behaviour for any remaining
 * direct callers — currently none, but kept for safety while the refactor is
 * in flight.
 */
export default function SupplierInvoicesPage({
  embedded = false,
}: { embedded?: boolean } = {}) {
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
      <div style={{ padding: 24, color: "var(--color-danger-fg)", fontSize: 14 }}>
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
              toast.error("Only draft bills can be deleted.");
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
        // Embedded mode: shell owns title + subtitle + actions.
        hideHeader={embedded}
        title="Bills"
        subtitle="Supplier bills are how inventory enters your system. Receiving a bill creates lots and stock."
        primaryAction={
          <ListingAction href="/supplier-invoices/new">
            <Plus className="size-3.5" />
            Record bill
          </ListingAction>
        }
        secondaryActions={
          <ListingAction href="/supplier-invoices/bulk" variant="outline">
            <Layers className="size-3.5" />
            Bulk import
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/supplier-invoices/${row.id}`)}
        rowActions={rowActions}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search bills, suppliers…"
        emptyTitle="No bills yet"
        emptyDescription="Record your first supplier bill to start receiving inventory."
        emptyAction={
          <ListingAction href="/supplier-invoices/new">
            <Plus className="size-3.5" />
            Record bill
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
        onSortChange={(key, dir) => pagination.setSort(key as SupplierInvoiceListSort, dir)}
      />

      <AlertDialog open={!!deletingInvoice} onOpenChange={open => { if (!open) setDeletingInvoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill</AlertDialogTitle>
            <AlertDialogDescription>
              Delete draft bill <strong>{deletingInvoice?.referenceNumber}</strong>? This removes all
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
