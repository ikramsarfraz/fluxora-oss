"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { ListingPage, type ListingColumn } from "@/components/listing-page";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import type { Category } from "@/services/categories";

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
            background: row.isActive ? "oklch(96% 0.04 155)" : "#f5f5f4",
            color: row.isActive ? "oklch(58% 0.13 155)" : "#78716c",
            fontWeight: 500,
          }}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    }),
  },
];

export default function Categories() {
  const router = useRouter();
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null);

  const { data: categories, isLoading, error, refetch } = useCategories();
  const deleteCategory = useDeleteCategory();

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

  const rows = categories ?? [];

  return (
    <>
      <ListingPage
        title="Categories"
        subtitle="Organize your product catalog with categories."
        primaryAction={
          <Link
            href="/categories/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#0c0a09",
              color: "#fafaf9",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add category
          </Link>
        }
        columns={COLUMNS}
        getRowId={row => row.id}
        onRowClick={row => router.push(`/categories/${row.id}`)}
        rowActions={[
          { label: "View", href: row => `/categories/${row.id}` },
          { label: "Delete", variant: "destructive", onClick: row => setDeletingCategory(row) },
        ]}
        rows={rows}
        total={rows.length}
        isLoading={isLoading}
        searchPlaceholder="Search categories…"
        emptyTitle="No categories yet"
        emptyDescription="Get started by adding your first category."
        emptyAction={
          <Link
            href="/categories/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#0c0a09",
              color: "#fafaf9",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add category
          </Link>
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

      <AlertDialog open={!!deletingCategory} onOpenChange={open => { if (!open) setDeletingCategory(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingCategory?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingCategory) return;
                deleteCategory.mutate(deletingCategory.id, {
                  onSuccess: () => toast.success("Category deleted."),
                  onError: (e: Error) => toast.error(e.message),
                });
                setDeletingCategory(null);
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
