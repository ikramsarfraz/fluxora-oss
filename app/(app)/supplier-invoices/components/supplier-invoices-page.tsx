"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import {
  useDeleteSupplierInvoice,
  useSupplierInvoicesPage,
} from "@/hooks/use-supplier-invoices";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";
import type { SupplierInvoiceListSort } from "@/services/receiving";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";

export default function SupplierInvoicesPage() {
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
  const { data: currentUser } = useCurrentPortalUser();
  const role = currentUser?.role ?? null;
  const canCreate = can(role, "edit_supplier_invoice");
  const canDelete = can(role, "delete_supplier_invoice");
  const createDeniedReason = canCreate
    ? undefined
    : getPermissionDeniedReason("edit_supplier_invoice");
  const deleteDeniedReason = canDelete
    ? undefined
    : getPermissionDeniedReason("delete_supplier_invoice");

  const columns = useMemo(
    () =>
      createColumns({
        canDelete,
        deleteDisabledReason: deleteDeniedReason,
        onDelete: invoice => {
          deleteInvoice.mutate(invoice.id, {
            onSuccess: () =>
              toast.success(
                `Draft invoice "${invoice.invoiceNumber}" deleted.`,
              ),
            onError: err =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Could not delete invoice.",
              ),
          });
        },
      }),
    [deleteInvoice, canDelete, deleteDeniedReason],
  );

  if (isLoading) {
    return <ListPageSkeleton tableColumns={6} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const invoices = data?.data ?? [];
  const hasInvoices =
    (data?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="supplier-invoices-heading"
    >
      <PageHeader
        title="Supplier invoices"
        description="Record incoming shipments. Completing an invoice automatically creates lots and inventory for traceability."
      >
        {canCreate ? (
          <Button asChild>
            <Link href="/supplier-invoices/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New invoice</span>
            </Link>
          </Button>
        ) : (
          <Button disabled title={createDeniedReason}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New invoice</span>
          </Button>
        )}
      </PageHeader>

      {hasInvoices ? (
        <DataTable
          columns={columns}
          data={invoices}
          searchPlaceholder="Search supplier invoices..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={data?.page ?? pagination.page}
          pageSize={data?.pageSize ?? pagination.pageSize}
          total={data?.total ?? 0}
          pageCount={data?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(
              nextSort as SupplierInvoiceListSort,
              nextDirection,
            );
          }}
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="No supplier invoices yet"
          description="Record your first supplier invoice to begin tracking inbound inventory."
        >
          {canCreate ? (
            <Button asChild>
              <Link href="/supplier-invoices/new">
                <Plus className="size-4" />
                New invoice
              </Link>
            </Button>
          ) : (
            <Button disabled title={createDeniedReason}>
              <Plus className="size-4" />
              New invoice
            </Button>
          )}
        </EmptyState>
      )}
    </section>
  );
}
