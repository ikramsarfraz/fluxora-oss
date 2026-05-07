"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { deleteCustomerAction } from "@/actions/customers";
import { useCustomersPage } from "@/hooks/use-customers";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { queryKeys } from "@/lib/query/keys";
import { formatDisplayDate } from "@/lib/utils/date";
import type { CustomerListItem, CustomerListSort } from "@/services/customers";

type CustomerRow = CustomerListItem;

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

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
      if (!address) return { primary: <span style={{ color: "#78716c" }}>—</span> };
      const parts = [address.city, address.state].filter(Boolean);
      return { primary: parts.join(", ") || "—" };
    },
  },
  {
    key: "invoicePrefix",
    header: "Invoice prefix",
    render: row =>
      row.invoicePrefix
        ? { primary: <MonoText>{row.invoicePrefix}</MonoText> }
        : { primary: <span style={{ color: "#78716c" }}>—</span> },
  },
  {
    key: "products",
    header: "Products",
    align: "right",
    render: row => {
      const count = row.productPrices?.length ?? 0;
      return { primary: <span style={{ color: "#78716c" }}>{count}</span> };
    },
  },
  {
    key: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    render: row => ({ primary: <MonoText>{formatDisplayDate(row.createdAt)}</MonoText> }),
  },
];

export default function Customers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null);

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
        title="Customers"
        subtitle="Manage your customer accounts and contact information."
        primaryAction={
          <Link
            href="/customers/new"
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
            Add customer
          </Link>
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
          <Link
            href="/customers/new"
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
            Add customer
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
