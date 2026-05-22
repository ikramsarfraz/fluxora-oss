"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { CsvImportModal, useCsvImportModal } from "@/modules/distribution/onboarding/components/csv-import-modal";
import { useQueryClient } from "@tanstack/react-query";

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
import { Badge } from "@/components/ui/badge";
import {
  ListingAction,
  ListingErrorState,
  ListingPage,
  ListingSecondaryAction,
  MonoText,
  type ListingColumn,
} from "@/components/listing-page";
import {
  archiveProductAction,
  permanentlyDeleteProductAction,
  restoreProductAction,
} from "@/modules/distribution/products/actions";
import { useProductsPage } from "../hooks/use-products";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { queryKeys } from "@/lib/query/keys";
import {
  formatProductDefaultPrice,
  getProductBaseUnitAbbreviation,
} from "../utils/product-uom";
import type {
  ProductArchivedFilter,
  ProductListItem,
  ProductListSort,
} from "../services/products";

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
      primary: (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {row.name}
          {row.archivedAt ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-full px-1.5 text-[10px] font-medium uppercase tracking-wide"
            >
              Archived
            </Badge>
          ) : null}
        </span>
      ),
      secondary: row.productCategories?.map(c => c.category.name).join(", ") || undefined,
    }),
  },
  {
    key: "defaultPricePerLb",
    header: "Default price",
    align: "right",
    render: row => {
      const formatted = formatProductDefaultPrice(row.defaultPricePerLb);
      if (formatted === "—") {
        return { primary: <span className="text-subtle">—</span> };
      }
      const abbr = getProductBaseUnitAbbreviation(row);
      return {
        primary: (
          <MonoText>
            {formatted}
            <span className="ml-1 text-[11px] text-subtle">/{abbr}</span>
          </MonoText>
        ),
      };
    },
  },
];

const STATUS_SEGMENTS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

type LifecycleAction = "archive" | "restore" | "permanent-delete";

type LifecycleTarget = {
  action: LifecycleAction;
  product: ProductRow;
};

export default function Products() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(
    null,
  );
  const { open: importOpen, openModal: openImport, closeModal: closeImport } = useCsvImportModal("products");

  // UI side of the lifecycle permission gate. Hides Archive / Restore /
  // Delete-permanently row actions for non-admins so they don't click
  // an affordance only to get a "Forbidden" toast back. The server
  // actions still enforce via requireAdminPortalUser as defense-in-depth.
  const { data: currentUser } = useCurrentPortalUser();
  const canManageLifecycle =
    currentUser?.role === "admin" || currentUser?.role === "owner";

  const pagination = useUrlPaginationState<
    ProductListSort,
    { archived: ProductArchivedFilter }
  >({
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: { archived: "active" },
  });

  const archivedFilter = pagination.filters.archived ?? "active";

  const { data, isLoading, isFetching, error, refetch } = useProductsPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
    archived: archivedFilter,
  });

  if (error) {
    return (
      <ListingErrorState
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  function lifecycleCopy(target: LifecycleTarget) {
    switch (target.action) {
      case "archive":
        return {
          title: "Archive product",
          description: (
            <>
              Archive <strong>{target.product.name}</strong>? It’ll be hidden
              from order and receiving pickers, but historical lines, prices,
              and bills stay intact. You can restore it later from the
              Archived tab.
            </>
          ),
          confirm: "Archive",
          // Archive is reversible (Restore lives one tab over), but it's
          // still a removal-flavored action — use the destructive theme
          // color so it's visually distinct from Restore.
          variant: "destructive" as const,
        };
      case "restore":
        return {
          title: "Restore product",
          description: (
            <>
              Restore <strong>{target.product.name}</strong>? It’ll be
              selectable again on new orders and receiving.
            </>
          ),
          confirm: "Restore",
          variant: "default" as const,
        };
      case "permanent-delete":
        return {
          title: "Delete permanently",
          description: (
            <>
              Delete <strong>{target.product.name}</strong> permanently?
              This can’t be undone. If the product has any orders,
              invoices, prices, or bills, the delete will fail — archive
              it instead.
            </>
          ),
          confirm: "Delete permanently",
          variant: "destructive" as const,
        };
    }
  }

  async function runLifecycleAction(target: LifecycleTarget) {
    const { action, product } = target;
    try {
      if (action === "archive") {
        await archiveProductAction(product.id);
        toast.success("Product archived.");
      } else if (action === "restore") {
        await restoreProductAction(product.id);
        toast.success("Product restored.");
      } else {
        await permanentlyDeleteProductAction(product.id);
        toast.success("Product deleted.");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
    setLifecycleTarget(null);
  }

  const copy = lifecycleTarget ? lifecycleCopy(lifecycleTarget) : null;

  return (
    <>
      <CsvImportModal importType="products" open={importOpen} onClose={closeImport} />
      <ListingPage
        title="Products"
        subtitle="Manage your product catalog."
        statusSegments={[...STATUS_SEGMENTS]}
        activeSegment={archivedFilter}
        onSegmentChange={value =>
          pagination.setFilter("archived", value as ProductArchivedFilter)
        }
        secondaryActions={
          <ListingSecondaryAction onClick={openImport}>
            <Upload className="size-3.5" />
            Import CSV
          </ListingSecondaryAction>
        }
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
          {
            label: "Archive",
            isVisible: row => canManageLifecycle && !row.archivedAt,
            onClick: row => setLifecycleTarget({ action: "archive", product: row }),
          },
          {
            label: "Restore",
            isVisible: row => canManageLifecycle && !!row.archivedAt,
            onClick: row => setLifecycleTarget({ action: "restore", product: row }),
          },
          {
            label: "Delete permanently",
            variant: "destructive",
            isVisible: row => canManageLifecycle && !!row.archivedAt,
            onClick: row =>
              setLifecycleTarget({ action: "permanent-delete", product: row }),
          },
        ]}
        rows={data?.data ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search products, SKU…"
        emptyTitle={archivedFilter === "archived" ? "No archived products" : "No products yet"}
        emptyDescription={
          archivedFilter === "archived"
            ? "When you archive a product, it’ll show up here."
            : "Get started by adding your first product to the catalog."
        }
        emptyAction={
          archivedFilter === "active" ? (
            <ListingAction href="/products/new">
              <Plus className="size-3.5" />
              Add product
            </ListingAction>
          ) : undefined
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

      <AlertDialog
        open={!!lifecycleTarget}
        onOpenChange={open => {
          if (!open) setLifecycleTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={copy?.variant}
              onClick={() => {
                if (!lifecycleTarget) return;
                void runLifecycleAction(lifecycleTarget);
              }}
            >
              {copy?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
