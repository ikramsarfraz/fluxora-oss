"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  useArchiveCategory,
  useCategory,
  useDeleteCategory,
  useUntagAndDeleteCategory,
} from "../hooks/use-categories";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailSection,
  DetailField,
  DetailGrid,
} from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

/**
 * Local dialog state.
 *   - "closed"  : no dialog visible
 *   - "confirm" : "are you sure?" before we hit the delete check
 *   - "blocked" : product_categories rows exist → show archive /
 *     untag-and-delete branches
 */
type DialogState =
  | { phase: "closed" }
  | { phase: "confirm" }
  | { phase: "blocked"; productCount: number };

export function CategoryDetailPage({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ phase: "closed" });

  const {
    data: category,
    isLoading,
    error: loadError,
    isError,
  } = useCategory(categoryId);

  useSetBreadcrumbLabel(`/categories/${categoryId}`, category?.name);

  const deleteCategory = useDeleteCategory();
  const archiveCategory = useArchiveCategory();
  const untagAndDeleteCategory = useUntagAndDeleteCategory();

  if (isLoading) return <PageLoading message="Loading category..." />;
  if (isError || !category)
    return (
      <PageError
        message={
          loadError ? (loadError as Error).message : "Category not found."
        }
      />
    );

  const isArchived = !!category.archivedAt;

  function handleDelete() {
    deleteCategory.mutate(categoryId, {
      onSuccess: result => {
        if (result.status === "deleted") {
          toast.success("Category deleted.");
          setDialog({ phase: "closed" });
          router.push("/categories");
          return;
        }
        setDialog({
          phase: "blocked",
          productCount: result.productCount,
        });
      },
      onError: (e: Error) => {
        toast.error(e.message);
        setDialog({ phase: "closed" });
      },
    });
  }

  const pendingAction =
    archiveCategory.isPending || untagAndDeleteCategory.isPending;

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={category.name}
        description="View category details and manage associated products."
        badge={
          isArchived ? (
            <Badge variant="outline" className="text-muted-foreground">
              Archived
            </Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )
        }
      >
        {!isArchived ? (
          <Button variant="outline" asChild>
            <Link href={`/categories/${category.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </DetailPageHeader>

      <DetailSection title="Details" description="Category information.">
        <DetailGrid>
          <DetailField label="Name">{category.name}</DetailField>
          <DetailField label="Slug">
            <span className="font-mono text-sm">{category.slug}</span>
          </DetailField>
          <DetailField label="Status">
            {isArchived ? "Archived" : "Active"}
          </DetailField>
          {category.description && (
            <DetailField label="Description">
              {category.description}
            </DetailField>
          )}
          <DetailField label="Created">
            {new Date(category.createdAt).toLocaleDateString()}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this category."
        className="border-destructive/50"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog({ phase: "confirm" })}
        >
          Delete category
        </Button>
      </DetailSection>

      <AlertDialog
        open={dialog.phase !== "closed"}
        onOpenChange={open => {
          if (!open) setDialog({ phase: "closed" });
        }}
      >
        <AlertDialogContent>
          {dialog.phase === "blocked" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Can’t delete this category</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{category.name}</strong> is tagged on{" "}
                  {dialog.productCount}{" "}
                  {dialog.productCount === 1 ? "product" : "products"}.
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
                    archiveCategory.mutate(categoryId, {
                      onSuccess: () => {
                        toast.success("Category archived.");
                        setDialog({ phase: "closed" });
                        router.push("/categories");
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
                    untagAndDeleteCategory.mutate(categoryId, {
                      onSuccess: result => {
                        toast.success(
                          `Untagged from ${result.untaggedCount} ${
                            result.untaggedCount === 1
                              ? "product"
                              : "products"
                          } and deleted.`,
                        );
                        setDialog({ phase: "closed" });
                        router.push("/categories");
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
                <AlertDialogTitle>Delete category?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete{" "}
                  <strong>{category.name}</strong>. If any product is still
                  tagged with this category, you’ll be given the choice to
                  archive instead or untag every product first. This action
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
                  onClick={handleDelete}
                >
                  {deleteCategory.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
