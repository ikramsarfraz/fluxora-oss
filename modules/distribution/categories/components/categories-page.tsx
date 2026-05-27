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
 * Local UI state for the delete confirmation dialog. The "blocked"
 * branch flips the dialog into the archive-or-untag choice; the
 * "confirm" branch is the simple "this is safe, are you sure?" copy.
 */
type DeleteState =
  | { phase: "confirm"; row: CategoryRow }
  | { phase: "blocked"; row: CategoryRow; productCount: number };

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

  // Centralized so both the confirm-button click and the dialog
  // open-blocked transition write to the same place. Treating the
  // "in use" result as "open a different dialog" instead of "show an
  // error toast" is the whole point of #231 — a blocked delete is a
  // valid, recoverable user flow.
  function handleDelete(row: CategoryRow) {
    deleteCategory.mutate(row.id, {
      onSuccess: result => {
        if (result.status === "deleted") {
          toast.success("Category deleted.");
          setDeleteState(null);
          return;
        }
        // Re-open with the blocked phase so the user sees the archive
        // / untag-and-delete choice without having to click "Delete"
        // a second time.
        setDeleteState({
          phase: "blocked",
          row,
          productCount: result.productCount,
        });
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
          <ListingAction href="/categories/new">
            <Plus className="size-3.5" />
            Add category
          </ListingAction>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/categories/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/categories/${row.id}` },
          {
            label: "Delete",
            variant: "destructive",
            onClick: row => setDeleteState({ phase: "confirm", row }),
          },
        ]}
        rows={rows}
        total={rows.length}
        isLoading={isLoading}
        searchPlaceholder="Search categories…"
        emptyTitle="No categories yet"
        emptyDescription="Get started by adding your first category."
        emptyAction={
          <ListingAction href="/categories/new">
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
