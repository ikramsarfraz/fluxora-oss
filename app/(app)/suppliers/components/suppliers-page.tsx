"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useDeleteSupplier } from "@/hooks/use-suppliers";
import type { SupplierListItem } from "@/services/suppliers";

export default function Suppliers() {
  const { data: suppliers, isLoading, error: loadError, refetch } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: (supplier: SupplierListItem) => {
          deleteSupplier.mutate(supplier.id);
        },
      }),
    [deleteSupplier]
  );

  if (isLoading) {
    return <PageLoading message="Loading suppliers..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasSuppliers = suppliers && suppliers.length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="suppliers-heading">
      <PageHeader
        title="Suppliers"
        description="Add and manage suppliers for lots and supplier invoices."
      >
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Supplier</span>
          </Link>
        </Button>
      </PageHeader>

      {hasSuppliers ? (
        <DataTable columns={columns} data={suppliers} />
      ) : (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Get started by adding your first supplier to the system."
        >
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="size-4" />
              Add Supplier
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
