"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ListingAction, ListingPage, MonoText, type ListingColumn } from "@/components/listing-page";
import { useDeleteUnitOfMeasure, useUnitsOfMeasure } from "../hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "../services/units-of-measure";

type UoMRow = UnitOfMeasureListItem;

const COLUMNS: ListingColumn<UoMRow>[] = [
  {
    key: "name",
    header: "Unit",
    render: row => ({
      primary: <span style={{ fontWeight: 500 }}>{row.name}</span>,
      secondary: row.notes ?? undefined,
    }),
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
    key: "sortOrder",
    header: "Sort order",
    align: "right",
    render: row => ({ primary: <span style={{ color: "var(--color-subtle)" }}>{row.sortOrder ?? 0}</span> }),
  },
  {
    key: "isActive",
    header: "Status",
    render: row => ({
      primary: (
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 100,
            background: row.isActive ? "var(--color-success-bg)" : "var(--color-divider)",
            color: row.isActive ? "var(--color-success-fg)" : "var(--color-subtle)",
            fontWeight: 500,
          }}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    }),
  },
];

export default function UnitsOfMeasure({
  title = "Units of Measure",
  subtitle = "Define units for inventory, purchasing, and sales.",
}: {
  title?: string;
  subtitle?: string;
} = {}) {
  const router = useRouter();
  const [deletingUnit, setDeletingUnit] = useState<UoMRow | null>(null);

  const { data: units, isLoading, error, refetch } = useUnitsOfMeasure();
  const deleteUnit = useDeleteUnitOfMeasure();

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

  const rows = units ?? [];

  return (
    <>
      <ListingPage
        title={title}
        subtitle={subtitle}
        primaryAction={
          <ListingAction href="/units-of-measure/new">
            <Plus className="size-3.5" />
            Add unit
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/units-of-measure/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/units-of-measure/${row.id}` },
          { label: "Delete", variant: "destructive", onClick: row => setDeletingUnit(row) },
        ]}
        rows={rows}
        total={rows.length}
        isLoading={isLoading}
        searchPlaceholder="Search units…"
        emptyTitle="No units of measure yet"
        emptyDescription="Add units like lb, case, each, etc."
        emptyAction={
          <ListingAction href="/units-of-measure/new">
            <Plus className="size-3.5" />
            Add unit
          </ListingAction>
        }
        hidePagination
        page={1}
        pageSize={rows.length || 10}
        pageCount={1}
        searchInput=""
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onSearchChange={() => {}}
      />

      <AlertDialog open={!!deletingUnit} onOpenChange={open => { if (!open) setDeletingUnit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingUnit?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingUnit) return;
                deleteUnit.mutate(deletingUnit.id, {
                  onSuccess: () => toast.success("Unit deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingUnit(null);
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
