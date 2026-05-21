"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CsvImportModal,
  useCsvImportModal,
  type CsvApplyResult,
  type CsvPreflightIssue,
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
import {
  ListingAction,
  ListingPage,
  MonoText,
  type ListingColumn,
} from "@/components/listing-page";
import { Badge } from "@/components/ui/badge";
import {
  archiveCustomerAction,
  bulkCreateCustomersAction,
  exportCustomersCsvAction,
  findCustomerImportConflictsAction,
  permanentlyDeleteCustomerAction,
  restoreCustomerAction,
} from "@/modules/distribution/customers/actions";
import { useCustomersPage } from "../hooks/use-customers";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { queryKeys } from "@/lib/query/keys";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatPhone } from "@/lib/utils/phone";
import { csvRowToCustomerInput } from "../utils/csv-row-mapping";
import type {
  CustomerArchivedFilter,
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
      primary: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{row.name}</span>
          {row.archivedAt ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-full px-1.5 text-[10px] font-medium uppercase tracking-wide"
            >
              Archived
            </Badge>
          ) : null}
        </span>
      ),
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
    header: "Invoice prefix",
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

const STATUS_SEGMENTS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;


type LifecycleAction = "archive" | "restore" | "permanent-delete";

type LifecycleTarget = {
  action: LifecycleAction;
  customer: CustomerRow;
};

export default function Customers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
  const { open: importOpen, openModal: openImport, closeModal: closeImport } = useCsvImportModal("customers");
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const { filename, csv } = await exportCustomersCsvAction(archivedFilter);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Customers exported.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleBulkImport(rows: Record<string, string>[]): Promise<CsvApplyResult> {
    const inputs = rows.map(csvRowToCustomerInput);
    const result = await bulkCreateCustomersAction(inputs);
    if (result.created > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    }
    return { created: result.created, failed: result.failed };
  }

  async function handlePreflight(
    rows: Record<string, string>[],
  ): Promise<CsvPreflightIssue[]> {
    const conflicts = await findCustomerImportConflictsAction(
      rows.map(r => ({
        name: r.name?.trim(),
        email: r.email?.trim() || undefined,
      })),
    );
    return conflicts.map(c => {
      // Row numbers in the modal are 1-based with header counted, so the
      // first data row is index 0 here → row 2 in the UI.
      const uiRow = c.rowIndex + 2;
      if (c.reason === "duplicate-name-active") {
        return {
          row: uiRow,
          severity: "error" as const,
          message: `An active customer named "${c.existingCustomerName}" already exists — this row will be skipped.`,
        };
      }
      if (c.reason === "duplicate-name-archived") {
        return {
          row: uiRow,
          severity: "error" as const,
          message: `An archived customer named "${c.existingCustomerName}" already exists. Restore it from the Archived tab instead of re-importing.`,
        };
      }
      return {
        row: uiRow,
        severity: "warning" as const,
        message: `Email matches an existing customer "${c.existingCustomerName}". Continuing will create a second record sharing this email.`,
      };
    });
  }

  const pagination = useUrlPaginationState<
    CustomerListSort,
    { archived: CustomerArchivedFilter }
  >({
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: { archived: "active" },
  });

  const archivedFilter = pagination.filters.archived ?? "active";

  const { data, isLoading, isFetching, error, refetch } = useCustomersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    archived: archivedFilter,
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

  function lifecycleCopy(target: LifecycleTarget) {
    switch (target.action) {
      case "archive":
        return {
          title: "Archive customer",
          description: (
            <>
              Archive <strong>{target.customer.name}</strong>? They&apos;ll be hidden from
              order and invoice lookups, but past orders, invoices, and payments stay intact.
              You can restore them later from the Archived tab.
            </>
          ),
          confirm: "Archive",
          // Archive is reversible (Restore lives one tab over), but it's
          // still a removal-flavored action — surface the destructive
          // theme color so it's visually distinct from Restore's
          // affirmative one and from a neutral OK button.
          variant: "destructive" as const,
        };
      case "restore":
        return {
          title: "Restore customer",
          description: (
            <>
              Restore <strong>{target.customer.name}</strong>? They&apos;ll be visible again
              everywhere customers appear.
            </>
          ),
          confirm: "Restore",
          variant: "default" as const,
        };
      case "permanent-delete":
        return {
          title: "Delete permanently",
          description: (
            <>
              Delete <strong>{target.customer.name}</strong> permanently? This can&apos;t be
              undone. If the customer has any orders or invoices, the delete will fail —
              archive them instead.
            </>
          ),
          confirm: "Delete permanently",
          variant: "destructive" as const,
        };
    }
  }

  async function runLifecycleAction(target: LifecycleTarget) {
    const { action, customer } = target;
    try {
      if (action === "archive") {
        await archiveCustomerAction(customer.id);
        toast.success("Customer archived.");
      } else if (action === "restore") {
        await restoreCustomerAction(customer.id);
        toast.success("Customer restored.");
      } else {
        await permanentlyDeleteCustomerAction(customer.id);
        toast.success("Customer deleted.");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
    setLifecycleTarget(null);
  }

  return (
    <>
      <CsvImportModal
        importType="customers"
        open={importOpen}
        onClose={closeImport}
        onApply={handleBulkImport}
        onPreflight={handlePreflight}
      />
      <ListingPage
        title="Customers"
        subtitle="Manage your customer accounts and contact information."
        statusSegments={[...STATUS_SEGMENTS]}
        activeSegment={archivedFilter}
        onSegmentChange={value =>
          pagination.setFilter("archived", value as CustomerArchivedFilter)
        }
        secondaryActions={
          <div style={{ display: "inline-flex", gap: 6 }}>
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                borderRadius: 6, fontSize: 13, fontWeight: 500,
                cursor: exporting ? "wait" : "pointer",
                opacity: exporting ? 0.6 : 1,
                background: "var(--color-card)", color: "var(--color-subtle)",
                border: "1px solid var(--color-border-default)", fontFamily: "inherit",
              }}
            >
              <Download size={13} /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button onClick={openImport} style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
              borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: "var(--color-card)", color: "var(--color-subtle)", border: "1px solid var(--color-border-default)", fontFamily: "inherit",
            }}>
              <Upload size={13} /> Import CSV
            </button>
          </div>
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
          {
            label: "Archive",
            isVisible: row => !row.archivedAt,
            onClick: row => setLifecycleTarget({ action: "archive", customer: row }),
          },
          {
            label: "Restore",
            isVisible: row => !!row.archivedAt,
            onClick: row => setLifecycleTarget({ action: "restore", customer: row }),
          },
          {
            label: "Delete permanently",
            variant: "destructive",
            isVisible: row => !!row.archivedAt,
            onClick: row =>
              setLifecycleTarget({ action: "permanent-delete", customer: row }),
          },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search customers…"
        emptyTitle={archivedFilter === "archived" ? "No archived customers" : "No customers yet"}
        emptyDescription={
          archivedFilter === "archived"
            ? "When you archive a customer, they'll show up here."
            : "Get started by adding your first customer."
        }
        emptyAction={
          archivedFilter === "active" ? (
            <ListingAction href="/customers/new">
              <Plus className="size-3.5" />
              Add customer
            </ListingAction>
          ) : undefined
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

      <AlertDialog
        open={!!lifecycleTarget}
        onOpenChange={open => {
          if (!open) setLifecycleTarget(null);
        }}
      >
        <AlertDialogContent>
          {lifecycleTarget ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{lifecycleCopy(lifecycleTarget).title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {lifecycleCopy(lifecycleTarget).description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant={lifecycleCopy(lifecycleTarget).variant}
                  onClick={() => runLifecycleAction(lifecycleTarget)}
                >
                  {lifecycleCopy(lifecycleTarget).confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
