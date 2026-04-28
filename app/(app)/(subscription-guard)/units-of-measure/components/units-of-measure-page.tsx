"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus, Ruler } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import {
  useUnitsOfMeasure,
  useDeleteUnitOfMeasure,
} from "@/hooks/use-units-of-measure";

export default function UnitsOfMeasure() {
  const {
    data: units,
    isLoading,
    error: loadError,
    refetch,
  } = useUnitsOfMeasure();
  const deleteUnit = useDeleteUnitOfMeasure();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: unit => deleteUnit.mutate(unit.id),
      }),
    [deleteUnit],
  );

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
    </>
  );
}
