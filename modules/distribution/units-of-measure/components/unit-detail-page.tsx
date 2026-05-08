"use client";

import { useRouter } from "next/navigation";

import { useUnitOfMeasure, useDeleteUnitOfMeasure } from "../hooks/use-units-of-measure";
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

export function UnitDetailPage({ unitId }: { unitId: string }) {
  const router = useRouter();

  const {
    data: unit,
    isLoading,
    error: loadError,
    isError,
  } = useUnitOfMeasure(unitId);

  useSetBreadcrumbLabel(`/units-of-measure/${unitId}`, unit?.name);

  const deleteUnit = useDeleteUnitOfMeasure();

  if (isLoading) return <PageLoading message="Loading unit..." />;
  if (isError || !unit)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Unit not found."}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={unit.name}
        description="View unit of measure details."
        badge={
          unit.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inactive
            </Badge>
          )
        }
      />

      <DetailSection title="Details" description="Unit configuration.">
        <DetailGrid>
          <DetailField label="Name">{unit.name}</DetailField>
          {unit.abbreviation && (
            <DetailField label="Abbreviation">
              <span className="font-mono text-sm">{unit.abbreviation}</span>
            </DetailField>
          )}
          <DetailField label="Sort order">{unit.sortOrder}</DetailField>
          <DetailField label="Status">
            {unit.isActive ? "Active" : "Inactive"}
          </DetailField>
          {unit.notes && (
            <DetailField label="Notes">{unit.notes}</DetailField>
          )}
          <DetailField label="Created">
            {new Date(unit.createdAt).toLocaleDateString()}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this unit."
        className="border-destructive/50"
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete unit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete unit?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{unit.name}</strong>. Products referencing this unit
                will lose their unit assignment. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteUnit.isPending}
                onClick={() => {
                  deleteUnit.mutate(unitId, {
                    onSuccess: () => router.push("/units-of-measure"),
                  });
                }}
              >
                {deleteUnit.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
