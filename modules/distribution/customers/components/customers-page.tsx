"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CsvImportModal,
  useCsvImportModal,
  type CsvApplyResult,
} from "@/modules/distribution/onboarding/components/csv-import-modal";
import { useQueryClient } from "@tanstack/react-query";

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
import {
  bulkCreateCustomersAction,
  deleteCustomerAction,
} from "@/modules/distribution/customers/actions";
import { useCustomersPage } from "../hooks/use-customers";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { queryKeys } from "@/lib/query/keys";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatPhone } from "@/lib/utils/phone";
import type {
  BulkCreateCustomerInput,
  CustomerListItem,
  CustomerListSort,
} from "../services/customers";

type CustomerRow = CustomerListItem;

const COLUMNS: ListingColumn<CustomerRow>[] = [
  {
    key: "name",
    header: "Customer",
    sortKey: "name",
    render: row => ({
      primary: <span style={{ fontWeight: 500 }}>{row.name}</span>,
      secondary: row.phoneNumber ? formatPhone(row.phoneNumber) : undefined,
    }),
  },
  {
    key: "location",
    header: "Location",
    render: row => {
      const address = row.addresses?.[0];
      if (!address) return { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> };
      const parts = [address.city, address.state].filter(Boolean);
      return { primary: parts.join(", ") || "—" };
    },
  },
  {
    key: "abbreviation",
    header: "Abbreviation",
    render: row =>
      row.abbreviation
        ? { primary: <MonoText>{row.abbreviation}</MonoText> }
        : { primary: <span style={{ color: "var(--color-subtle)" }}>—</span> },
  },
  {
    key: "products",
    header: "Products",
    align: "right",
    render: row => {
      const count = row.productPrices?.length ?? 0;
      return { primary: <span style={{ color: "var(--color-subtle)" }}>{count}</span> };
    },
  },
  {
    key: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.createdAt)}</MonoText> }),
  },
];

function csvRowToCustomerInput(row: Record<string, string>): BulkCreateCustomerInput {
  // Only construct an address block when the user gave us a street —
  // any of city/state/zip alone is meaningless without a line 1 and
  // would fail the customer_addresses NOT NULL constraint.
  const street = row.address_line1?.trim() || "";
  const addresses = street
    ? [
        {
          addressType: "shipping" as const,
          street,
          city: row.address_city?.trim() || null,
          state: row.address_state?.trim() || null,
          zip: row.address_zip?.trim() || null,
          isDefault: true,
        },
      ]
    : undefined;

  return {
    name: row.name?.trim() ?? "",
    abbreviation: row.abbreviation?.trim() || null,
    phoneNumber: row.phone?.trim() || null,
    fuelSurchargeAmount: row.fuel_surcharge?.trim() || null,
    addresses,
  };
}

export default function Customers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null);
  const { open: importOpen, openModal: openImport, closeModal: closeImport } = useCsvImportModal("customers");

  async function handleBulkImport(rows: Record<string, string>[]): Promise<CsvApplyResult> {
    const inputs = rows.map(csvRowToCustomerInput);
    const result = await bulkCreateCustomersAction(inputs);
    if (result.created > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    }
    return { created: result.created, failed: result.failed };
  }

  const pagination = useUrlPaginationState<CustomerListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useCustomersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

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
        importType="customers"
        open={importOpen}
        onClose={closeImport}
        onApply={handleBulkImport}
      />
      <ListingPage
        title="Customers"
        subtitle="Manage your customer accounts and contact information."
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
          <ListingAction href="/customers/new">
            <Plus className="size-3.5" />
            Add customer
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/customers/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/customers/${row.id}` },
          { label: "Delete", variant: "destructive", onClick: row => setDeletingCustomer(row) },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search customers…"
        emptyTitle="No customers yet"
        emptyDescription="Get started by adding your first customer."
        emptyAction={
          <ListingAction href="/customers/new">
            <Plus className="size-3.5" />
            Add customer
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
        onSortChange={(key, dir) => pagination.setSort(key as CustomerListSort, dir)}
      />

      <AlertDialog open={!!deletingCustomer} onOpenChange={open => { if (!open) setDeletingCustomer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingCustomer?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!deletingCustomer) return;
                try {
                  await deleteCustomerAction(deletingCustomer.id);
                  await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
                  toast.success("Customer deleted.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to delete customer.");
                }
                setDeletingCustomer(null);
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
