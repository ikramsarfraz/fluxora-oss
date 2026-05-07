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
import { useDeleteProduct, useProductsPage } from "@/hooks/use-products";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatMoney } from "@/lib/utils/currency";
import type { ProductListItem, ProductListSort } from "@/services/products";

type ProductRow = ProductListItem;

const COLUMNS: ListingColumn<ProductRow>[] = [
  {
    key: "sku",
    header: "SKU",
    sortKey: "sku",
    width: "120px",
    render: row => ({ primary: <MonoText>{row.sku}</MonoText> }),
  },
  {
    key: "name",
    header: "Name",
    sortKey: "name",
    render: row => ({
      primary: <span style={{ fontWeight: 500 }}>{row.name}</span>,
      secondary: row.productCategories?.map(c => c.category.name).join(", ") || undefined,
    }),
  },
  {
    key: "defaultPricePerLb",
    header: "Price / lb",
    align: "right",
    render: row =>
      row.defaultPricePerLb
        ? { primary: <MonoText>{formatMoney(row.defaultPricePerLb)}</MonoText> }
        : { primary: <span style={{ color: "#78716c" }}>—</span> },
  },
];

export default function Products() {
  const router = useRouter();
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);

  const pagination = useUrlPaginationState<ProductListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useProductsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const deleteProduct = useDeleteProduct();

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

  return (
    <>
      <ListingPage
        title="Products"
        subtitle="Manage your product catalog."
        primaryAction={
          <ListingAction href="/products/new">
            <Plus className="size-3.5" />
            Add product
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/products/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/products/${row.id}` },
          { label: "Delete", variant: "destructive", onClick: row => setDeletingProduct(row) },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search products, SKU…"
        emptyTitle="No products yet"
        emptyDescription="Get started by adding your first product to the catalog."
        emptyAction={
          <ListingAction href="/products/new">
            <Plus className="size-3.5" />
            Add product
          </ListingAction>
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
        onSortChange={(key, dir) => pagination.setSort(key as ProductListSort, dir)}
      />

      <AlertDialog open={!!deletingProduct} onOpenChange={open => { if (!open) setDeletingProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingProduct) return;
                deleteProduct.mutate(deletingProduct.id, {
                  onSuccess: () => toast.success("Product deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingProduct(null);
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
