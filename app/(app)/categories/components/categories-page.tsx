"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";

export default function Categories() {
  const {
    data: categories,
    isLoading,
    error: loadError,
    refetch,
  } = useCategories();
  const deleteCategory = useDeleteCategory();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: category => deleteCategory.mutate(category.id),
      }),
    [deleteCategory],
  );

  if (isLoading) {
    return <PageLoading message="Loading categories..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasCategories = categories && categories.length > 0;

  return (
    <>
      <section className="flex flex-col gap-6" aria-labelledby="uom-heading">
        <PageHeader
          title="Categories"
          description="Define the units you use for inventory, purchasing, and sales (lb, case, each, etc.)."
        >
          <Button asChild>
            <Link href="/categories/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Category</span>
            </Link>
          </Button>
        </PageHeader>

        {hasCategories ? (
          <DataTable columns={columns} data={categories} />
        ) : (
          <EmptyState
            icon={Package}
            title="No categories yet"
            description="Get started by adding your first category."
          >
            <Button asChild>
              <Link href="/categories/new">
                <Plus className="size-4" />
                Add Category
              </Link>
            </Button>
          </EmptyState>
        )}
      </section>

      {/* <EditUnitDialog
        unit={editingUnit}
        open={!!editingUnit}
        onOpenChange={(open) => {
          if (!open) setEditingUnit(null);
        }}
      /> */}
    </>
  );
}
