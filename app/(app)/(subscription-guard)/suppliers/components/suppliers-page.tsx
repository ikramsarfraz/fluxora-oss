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
import { ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { useDeleteSupplier, useSuppliersPage } from "@/hooks/use-suppliers";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import type { SupplierListItem, SupplierListSort } from "@/services/suppliers";

type SupplierRow = SupplierListItem;

const COLUMNS: ListingColumn<SupplierRow>[] = [
  {
    key: "name",
    header: "Supplier",
    sortKey: "name",
    render: row => ({
      primary: <span style={{ fontWeight: 500 }}>{row.name}</span>,
    }),
  },
  {
    key: "netDays",
    header: "Net terms",
    sortKey: "netDays",
    render: row => ({
      primary: row.netDays !== null && row.netDays !== undefined
        ? `Net ${row.netDays}`
        : <span style={{ color: "#78716c" }}>—</span>,
    }),
  },
  {
    key: "products",
    header: "Products",
    align: "right",
    render: row => ({
      primary: <span style={{ color: "#78716c" }}>{row.productCosts?.length ?? 0}</span>,
    }),
  },
  {
    key: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.createdAt)}</MonoText> }),
  },
];

export default function Suppliers() {
  const router = useRouter();
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierRow | null>(null);

  const pagination = useUrlPaginationState<SupplierListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useSuppliersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const deleteSupplier = useDeleteSupplier();

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
    <>
      <ListingPage
        title="Suppliers"
        subtitle="Manage your supplier accounts."
        primaryAction={
          <Link
            href="/suppliers/new"
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
            Add supplier
          </Link>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/suppliers/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/suppliers/${row.id}` },
          { label: "Delete", variant: "destructive", onClick: row => setDeletingSupplier(row) },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search suppliers…"
        emptyTitle="No suppliers yet"
        emptyDescription="Add a supplier to start receiving inventory."
        emptyAction={
          <Link
            href="/suppliers/new"
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
            Add supplier
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
        onSortChange={(key, dir) => pagination.setSort(key as SupplierListSort, dir)}
      />

      <AlertDialog open={!!deletingSupplier} onOpenChange={open => { if (!open) setDeletingSupplier(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingSupplier?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingSupplier) return;
                deleteSupplier.mutate(deletingSupplier.id, {
                  onSuccess: () => toast.success("Supplier deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingSupplier(null);
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
