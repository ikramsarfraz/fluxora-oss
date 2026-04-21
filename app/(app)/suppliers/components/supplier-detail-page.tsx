"use client";

import { useRouter } from "next/navigation";

import { useSupplier, useDeleteSupplier } from "@/hooks/use-suppliers";
import { formatDisplayDate } from "@/lib/utils/date";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailSection,
  DetailField,
  DetailGrid,
} from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
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

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const {
    data: supplier,
    isLoading,
    isError,
    error: loadError,
  } = useSupplier(supplierId);

  useSetBreadcrumbLabel(`/suppliers/${supplierId}`, supplier?.name);

  const deleteSupplier = useDeleteSupplier();

  if (isLoading) return <PageLoading message="Loading supplier..." />;
  if (isError || !supplier)
    return (
      <PageError
        message={
          loadError ? (loadError as Error).message : "Supplier not found."
        }
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={supplier.name}
        description="Supplier details and account history."
      />

      <DetailSection
        title="Details"
        description="Basic information about this supplier."
      >
        <DetailGrid>
          <DetailField label="Name">{supplier.name}</DetailField>
          <DetailField label="Created">
            {formatDisplayDate(supplier.createdAt)}
          </DetailField>
          <DetailField label="Last updated">
            {formatDisplayDate(supplier.updatedAt)}
          </DetailField>
          {supplier.archivedAt ? (
            <DetailField label="Archived">
              {formatDisplayDate(supplier.archivedAt)}
            </DetailField>
          ) : null}
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this supplier."
        className="border-destructive/50"
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete supplier
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{supplier.name}</strong> and all associated data.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteSupplier.isPending}
                onClick={() => {
                  deleteSupplier.mutate(supplierId, {
                    onSuccess: () => router.push("/suppliers"),
                  });
                }}
              >
                {deleteSupplier.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
