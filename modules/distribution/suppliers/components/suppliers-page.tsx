"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CsvImportModal,
  useCsvImportModal,
  type CsvApplyResult,
} from "@/modules/distribution/onboarding/components/csv-import-modal";

import { bulkCreateSuppliersAction } from "@/modules/distribution/suppliers/actions";
import { queryKeys } from "@/lib/query/keys";
import type { CreateSupplierInput } from "../services/suppliers";

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
import { ListingAction, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { useDeleteSupplier, useSuppliersPage } from "../hooks/use-suppliers";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import type { SupplierListItem, SupplierListSort } from "../services/suppliers";

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
        : <span style={{ color: "var(--color-subtle)" }}>—</span>,
    }),
  },
  {
    key: "products",
    header: "Products",
    align: "right",
    render: row => ({
      primary: <span style={{ color: "var(--color-subtle)" }}>{row.productCosts?.length ?? 0}</span>,
    }),
  },
  {
    key: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.createdAt)}</MonoText> }),
  },
];

function csvRowToSupplierInput(row: Record<string, string>): CreateSupplierInput {
  return {
    name: row.name ?? "",
    netDays:
      row.net_days && row.net_days.trim() !== "" ? Number(row.net_days) : null,
    primaryContactName: row.primary_contact_name || null,
    primaryContactEmail: row.primary_contact_email || null,
    primaryContactPhone: row.primary_contact_phone || null,
    taxId: row.tax_id || null,
    accountNumber: row.account_number || null,
    addressLine1: row.address_line1 || null,
    addressLine2: row.address_line2 || null,
    addressCity: row.address_city || null,
    addressRegion: row.address_region || null,
    addressPostalCode: row.address_postal_code || null,
    websiteUrl: row.website_url || null,
    notes: row.notes || null,
  };
}

export default function Suppliers({ belowHeader }: { belowHeader?: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierRow | null>(null);
  const { open: importOpen, openModal: openImport, closeModal: closeImport } = useCsvImportModal("suppliers");

  async function handleBulkImport(rows: Record<string, string>[]): Promise<CsvApplyResult> {
    const inputs = rows.map(csvRowToSupplierInput);
    const result = await bulkCreateSuppliersAction(inputs);
    if (result.created > 0) {
      // refresh the listing without waiting for a route revalidation roundtrip
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    }
    return { created: result.created, failed: result.failed };
  }

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
      <div style={{ padding: 24, color: "var(--color-danger-fg)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button type="button" onClick={() => refetch()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <CsvImportModal
        importType="suppliers"
        open={importOpen}
        onClose={closeImport}
        onApply={handleBulkImport}
      />
      <ListingPage
        title="Suppliers"
        subtitle="Manage your supplier accounts."
        belowHeader={belowHeader}
        secondaryActions={
          <button onClick={openImport} style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
            borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: "var(--color-card)", color: "var(--color-subtle)", border: "1px solid var(--color-border-default)", fontFamily: "inherit",
          }}>
            <Upload size={13} /> Import CSV
          </button>
        }
        primaryAction={
          <ListingAction href="/suppliers/new">
            <Plus className="size-3.5" />
            Add supplier
          </ListingAction>
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
          <ListingAction href="/suppliers/new">
            <Plus className="size-3.5" />
            Add supplier
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
