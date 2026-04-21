"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useDeleteProduct } from "@/hooks/use-product-mutations";
import { Plus, Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import type { ProductListItem } from "@/services/products";

export default function Products() {
  const {
    data: products,
    isLoading,
    error: loadError,
    refetch,
  } = useProducts();
  const deleteProduct = useDeleteProduct();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: (product: ProductListItem) => {
          deleteProduct.mutate(product.id);
        },
      }),
    [deleteProduct],
  );

  if (isLoading) {
    return <PageLoading message="Loading products..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasProducts = products && products.length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="products-heading">
      <PageHeader
        title="Products"
        description="Manage your product catalog and inventory items."
      >
        <Button asChild>
          <Link href="/products/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Link>
        </Button>
      </PageHeader>

      {hasProducts ? (
        <DataTable columns={columns} data={products} />
      ) : (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Get started by adding your first product to the catalog."
        >
          <Button asChild>
            <Link href="/products/new">
              <Plus className="size-4" />
              Add Product
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
