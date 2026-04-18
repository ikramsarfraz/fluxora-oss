"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus, Ruler } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
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
import { toast } from "sonner";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { EditUnitDialog } from "./edit-unit-dialog";
import { useUnitsOfMeasure, useDeleteUnitOfMeasure } from "@/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/services/units-of-measure";

export default function UnitsOfMeasure() {
  const { data: units, isLoading, error: loadError, refetch } = useUnitsOfMeasure();
  const deleteUnit = useDeleteUnitOfMeasure();

  const [editingUnit, setEditingUnit] = useState<UnitOfMeasureListItem | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<UnitOfMeasureListItem | null>(null);

  const columns = useMemo(
    () =>
      createColumns({
        onEdit: (unit) => setEditingUnit(unit),
        onDelete: (unit) => setDeletingUnit(unit),
      }),
    []
  );

  const handleDelete = async () => {
    if (!deletingUnit) return;

    try {
      await deleteUnit.mutateAsync(deletingUnit.id);
      toast.success(`"${deletingUnit.name}" has been deleted.`);
      setDeletingUnit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete unit");
    }
  };

  if (isLoading) {
    return <PageLoading message="Loading units of measure..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasUnits = units && units.length > 0;

  return (
    <>
      <section className="flex flex-col gap-6" aria-labelledby="uom-heading">
        <PageHeader
          title="Units of Measure"
          description="Define the units you use for inventory, purchasing, and sales (lb, case, each, etc.)."
        >
          <Button asChild>
            <Link href="/units-of-measure/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Unit</span>
            </Link>
          </Button>
        </PageHeader>

        {hasUnits ? (
          <DataTable columns={columns} data={units} />
        ) : (
          <EmptyState
            icon={Ruler}
            title="No units of measure yet"
            description="Get started by adding your first unit of measure like 'lb', 'case', or 'each'."
          >
            <Button asChild>
              <Link href="/units-of-measure/new">
                <Plus className="size-4" />
                Add Unit
              </Link>
            </Button>
          </EmptyState>
        )}
      </section>

      <EditUnitDialog
        unit={editingUnit}
        open={!!editingUnit}
        onOpenChange={(open) => {
          if (!open) setEditingUnit(null);
        }}
      />

      <AlertDialog open={!!deletingUnit} onOpenChange={(open) => !open && setDeletingUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit of measure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingUnit?.name}&quot;? Products using this
              unit will have it cleared. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteUnit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUnit.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
