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
import {
  ListingAction,
  ListingPage,
  type ListingColumn,
} from "@/components/listing-page";
import {
  useArchiveCategory,
  useCategories,
  useDeleteCategory,
  useUntagAndDeleteCategory,
} from "../hooks/use-categories";
import type { Category } from "../services/categories";

type CategoryRow = Category;

const COLUMNS: ListingColumn<CategoryRow>[] = [
  {
    key: "name",
    header: "Name",
    render: row => ({
      primary: <span style={{ fontWeight: 500 }}>{row.name}</span>,
      secondary: row.description ?? undefined,
    }),
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
            background: row.isActive
              ? "var(--color-success-bg)"
              : "var(--color-divider)",
            color: row.isActive
              ? "var(--color-success-fg)"
              : "var(--color-subtle)",
            fontWeight: 500,
          }}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    }),
  },
];

/**
 * Local UI state for the delete confirmation dialog. The phase is
 * resolved at open time from the row's productCount (carried in the
 * list query) so the user never sees a mid-flow flip between phases.
 * Once open, the dialog stays in its initial phase regardless of what
 * happens elsewhere.
 */
type DeleteState =
  | { phase: "confirm"; row: CategoryRow }
  | { phase: "blocked"; row: CategoryRow; productCount: number };

function openDeleteFor(row: CategoryRow): DeleteState {
  return row.productCount > 0
    ? { phase: "blocked", row, productCount: row.productCount }
    : { phase: "confirm", row };
}

export default function Categories({
  title = "Categories",
  subtitle = "Organize your product catalog with categories.",
}: {
  title?: string;
  subtitle?: string;
} = {}) {
  const router = useRouter();
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const { data: categories, isLoading, error, refetch } = useCategories();
  const deleteCategory = useDeleteCategory();
  const archiveCategory = useArchiveCategory();
  const untagAndDeleteCategory = useUntagAndDeleteCategory();

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--color-danger-fg)",
          fontSize: 14,
        }}
      >
        {(error as Error).message}{" "}
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            textDecoration: "underline",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const rows = categories ?? [];

  // The list query carries productCount per row so we know up front
  // whether the action is safe. If the row's count is stale (someone
  // else tagged a product since the last refetch) the server still
  // returns `status: "blocked"` — we surface that as a toast instead of
  // flipping the dialog mid-flow, and refetch so the next click is
  // routed correctly.
  function handleDelete(row: CategoryRow) {
    deleteCategory.mutate(row.id, {
      onSuccess: result => {
        if (result.status === "deleted") {
          toast.success("Category deleted.");
          setDeleteState(null);
          return;
        }
        toast.error(
          `Can't delete — ${result.productCount} ${
            result.productCount === 1 ? "product is" : "products are"
          } now tagged with this category. Refreshing…`,
        );
        setDeleteState(null);
        refetch();
      },
      onError: (e: Error) => {
        toast.error(e.message);
        setDeleteState(null);
      },
    });
  }

  const pendingAction =
    archiveCategory.isPending || untagAndDeleteCategory.isPending;

  return (
    <>
      <ListingPage
        title={title}
        subtitle={subtitle}
        primaryAction={
          <ListingAction href="/settings/workspace/categories/new">
            <Plus className="size-3.5" />
            Add category
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/settings/workspace/categories/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/settings/workspace/categories/${row.id}` },
          {
            label: "Delete",
            variant: "destructive",
            onClick: row => setDeleteState(openDeleteFor(row)),
          },
        ]}
        rows={rows}
        total={rows.length}
        isLoading={isLoading}
        searchPlaceholder="Search categories…"
        emptyTitle="No categories yet"
        emptyDescription="Get started by adding your first category."
        emptyAction={
          <ListingAction href="/settings/workspace/categories/new">
            <Plus className="size-3.5" />
            Add category
          </ListingAction>
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

      <AlertDialog
        open={!!deleteState}
        onOpenChange={open => {
          if (!open) setDeleteState(null);
        }}
      >
        <AlertDialogContent>
          {deleteState?.phase === "blocked" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Can’t delete this category</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{deleteState.row.name}</strong> is tagged on{" "}
                  {deleteState.productCount}{" "}
                  {deleteState.productCount === 1 ? "product" : "products"}.
                  Archive it instead to hide it from pickers while keeping
                  history, or untag every product and delete it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingAction}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={pendingAction}
                  onClick={() => {
                    archiveCategory.mutate(deleteState.row.id, {
                      onSuccess: () => {
                        toast.success("Category archived.");
                        setDeleteState(null);
                      },
                      onError: (e: Error) => toast.error(e.message),
                    });
                  }}
                >
                  {archiveCategory.isPending
                    ? "Archiving…"
                    : "Archive instead"}
                </AlertDialogAction>
                <AlertDialogAction
                  variant="destructive"
                  disabled={pendingAction}
                  onClick={() => {
                    untagAndDeleteCategory.mutate(deleteState.row.id, {
                      onSuccess: result => {
                        toast.success(
                          `Untagged from ${result.untaggedCount} ${
                            result.untaggedCount === 1
                              ? "product"
                              : "products"
                          } and deleted.`,
                        );
                        setDeleteState(null);
                      },
                      onError: (e: Error) => toast.error(e.message),
                    });
                  }}
                >
                  {untagAndDeleteCategory.isPending
                    ? "Deleting…"
                    : "Untag and delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete category</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete <strong>{deleteState?.row.name}</strong>? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteCategory.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteCategory.isPending}
                  onClick={() => {
                    if (deleteState) handleDelete(deleteState.row);
                  }}
                >
                  {deleteCategory.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
