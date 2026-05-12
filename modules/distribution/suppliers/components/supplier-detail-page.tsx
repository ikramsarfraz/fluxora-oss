"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { useSupplier, useDeleteSupplier } from "../hooks/use-suppliers";
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

import { SupplierEditPaymentTermsDialog } from "./supplier-edit-payment-terms-dialog";
import { SupplierReliabilityEmptyState } from "@/modules/distribution/components/empty-states";

function formatPaymentTerms(netDays: number | null | undefined): string {
  if (netDays == null) return "Net-0 (not set)";
  if (netDays === 0) return "Net-0 (due on invoice date)";
  return `Net-${netDays} (${netDays} day${netDays === 1 ? "" : "s"})`;
}

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [editTermsOpen, setEditTermsOpen] = useState(false);
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
      >
        {!supplier.archivedAt ? (
          <Button variant="outline" asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Pencil className="size-4" />
              Edit supplier
            </Link>
          </Button>
        ) : null}
      </DetailPageHeader>

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
        title="Payment terms"
        description="Used to compute due dates for this supplier's invoices in AP aging."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <DetailGrid>
            <DetailField label="Terms">
              <span className="tabular-nums">
                {formatPaymentTerms(supplier.netDays)}
              </span>
            </DetailField>
          </DetailGrid>
          {!supplier.archivedAt ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditTermsOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit payment terms
            </Button>
          ) : null}
        </div>
      </DetailSection>

      <SupplierEditPaymentTermsDialog
        supplierId={supplierId}
        supplierName={supplier.name}
        currentNetDays={supplier.netDays}
        open={editTermsOpen}
        onOpenChange={setEditTermsOpen}
      />

      {supplier._invoiceCount < 5 && (
        <DetailSection
          title="Reliability scoring"
          description="Unlocks after 5 completed invoices with this supplier."
        >
          <SupplierReliabilityEmptyState
            invoiceCount={supplier._invoiceCount}
            supplierName={supplier.name}
          />
        </DetailSection>
      )}

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
