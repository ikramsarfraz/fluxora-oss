"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useDeleteProduct, useProductsPage } from "@/hooks/use-products";
import { Plus, Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import type { ProductListItem, ProductListSort } from "@/services/products";

export default function Products() {
  const pagination = useUrlPaginationState<ProductListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });
  const {
    data: products,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useProductsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });
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
    return <ListPageSkeleton tableColumns={5} />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasProducts =
    (products?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

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
        <DataTable
          columns={columns}
          data={products?.data ?? []}
          searchPlaceholder="Search products..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={products?.page ?? pagination.page}
          pageSize={products?.pageSize ?? pagination.pageSize}
          total={products?.total ?? 0}
          pageCount={products?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as ProductListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
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
