"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { useCategory } from "../hooks/use-categories";
import { useDeleteCategory } from "../hooks/use-categories";
import { queryKeys } from "@/lib/query/keys";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

export function CategoryDetailPage({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: category,
    isLoading,
    error: loadError,
    isError,
  } = useCategory(categoryId);

  useSetBreadcrumbLabel(`/categories/${categoryId}`, category?.name);

  const deleteCategory = useDeleteCategory();

  if (isLoading) return <PageLoading message="Loading category..." />;
  if (isError || !category)
    return (
      <PageError
        message={
          loadError ? (loadError as Error).message : "Category not found."
        }
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={category.name}
        description="View category details and manage associated products."
        badge={
          category.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Archived
            </Badge>
          )
        }
      >
        {category.isActive && !category.archivedAt ? (
          <Button variant="outline" asChild>
            <Link href={`/categories/${category.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </DetailPageHeader>

      <DetailSection
        title="Details"
        description="Category information."
      >
        <DetailGrid>
          <DetailField label="Name">{category.name}</DetailField>
          <DetailField label="Slug">
            <span className="font-mono text-sm">{category.slug}</span>
          </DetailField>
          <DetailField label="Status">
            {category.isActive ? "Active" : "Archived"}
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete category
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete category?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{category.name}</strong>. Products in this category
                will not be deleted but will lose this category assignment.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteCategory.isPending}
                onClick={() => {
                  deleteCategory.mutate(categoryId, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.categories.all,
                      });
                      router.push("/categories");
                    },
                  });
                }}
              >
                {deleteCategory.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
