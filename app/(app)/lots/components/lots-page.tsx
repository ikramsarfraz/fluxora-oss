"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useLots, useDeleteLot } from "@/hooks/use-lots";

export default function Lots() {
  const {
    data: lots,
    isLoading,
    error: loadError,
    refetch,
  } = useLots();
  const deleteLot = useDeleteLot();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: lot => deleteLot.mutate(lot.id),
      }),
    [deleteLot],
  );

  if (isLoading) {
    return <PageLoading message="Loading lots..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasLots = lots && lots.length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="lots-heading">
      <PageHeader
        title="Lots"
        description="Track inbound lots for USDA traceability. Sorted by expiration (FEFO)."
      >
        <Button asChild>
          <Link href="/lots/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Lot</span>
          </Link>
        </Button>
      </PageHeader>

      {hasLots ? (
        <DataTable columns={columns} data={lots} />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="No lots yet"
          description="Get started by adding your first lot."
        >
          <Button asChild>
            <Link href="/lots/new">
              <Plus className="size-4" />
              Add Lot
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
