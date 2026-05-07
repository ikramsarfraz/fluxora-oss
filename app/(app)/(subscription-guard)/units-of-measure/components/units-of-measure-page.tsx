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
import { useDeleteUnitOfMeasure, useUnitsOfMeasure } from "@/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/services/units-of-measure";

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
        : { primary: <span style={{ color: "#78716c" }}>—</span> },
  },
  {
    key: "sortOrder",
    header: "Sort order",
    align: "right",
    render: row => ({ primary: <span style={{ color: "#78716c" }}>{row.sortOrder ?? 0}</span> }),
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
            background: row.isActive ? "oklch(96% 0.04 155)" : "#f5f5f4",
            color: row.isActive ? "oklch(58% 0.13 155)" : "#78716c",
            fontWeight: 500,
          }}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    }),
  },
];

export default function UnitsOfMeasure() {
  const router = useRouter();
  const [deletingUnit, setDeletingUnit] = useState<UoMRow | null>(null);

  const { data: units, isLoading, error, refetch } = useUnitsOfMeasure();
  const deleteUnit = useDeleteUnitOfMeasure();

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

  const rows = units ?? [];

  return (
    <>
      <ListingPage
        title="Units of Measure"
        subtitle="Define units for inventory, purchasing, and sales."
        primaryAction={
          <Link
            href="/units-of-measure/new"
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
            Add unit
          </Link>
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
          <Link
            href="/units-of-measure/new"
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
            Add unit
          </Link>
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
