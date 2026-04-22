"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { useLot, useDeleteLot } from "@/hooks/use-lots";
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
import { formatDisplayDate } from "@/lib/utils/date";

function parseIsoDate(s: string): Date {
  return new Date(s + "T12:00:00Z");
}

function ExpirationBadge({ expirationDate }: { expirationDate: string }) {
  const exp = parseIsoDate(expirationDate);
  const now = new Date();
  const daysLeft = Math.ceil(
    (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysLeft < 0) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (daysLeft <= 7) {
    return <Badge variant="secondary">Expires in {daysLeft}d</Badge>;
  }
  return <Badge variant="outline">Fresh</Badge>;
}

export function LotDetailPage({ lotId }: { lotId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: lot,
    isLoading,
    error: loadError,
    isError,
  } = useLot(lotId);

  useSetBreadcrumbLabel(`/lots/${lotId}`, lot?.lotNumber);

  const deleteLot = useDeleteLot();

  if (isLoading) return <PageLoading message="Loading lot..." />;
  if (isError || !lot)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Lot not found."}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={lot.lotNumber}
        description="View lot details and supplier traceability."
        badge={<ExpirationBadge expirationDate={lot.expirationDate} />}
      />

      <DetailSection title="Details" description="Lot traceability information.">
        <DetailGrid>
          <DetailField label="Lot number">
            <span className="font-mono text-sm">{lot.lotNumber}</span>
          </DetailField>
          <DetailField label="Supplier">
            {lot.supplier ? (
              <Link
                href={`/suppliers/${lot.supplier.id}`}
                className="hover:underline"
              >
                {lot.supplier.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </DetailField>
          <DetailField label="Receive date">
            {formatDisplayDate(lot.receiveDate)}
          </DetailField>
          <DetailField label="Expiration date">
            {formatDisplayDate(lot.expirationDate)}
          </DetailField>
          <DetailField label="Created">
            {new Date(lot.createdAt).toLocaleDateString()}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this lot."
        className="border-destructive/50"
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete lot
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete lot?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{lot.lotNumber}</strong>.
                Delete will fail if inventory items or supplier invoice lines
                still reference this lot. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteLot.isPending}
                onClick={() => {
                  deleteLot.mutate(lotId, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.lots.all,
                      });
                      router.push("/lots");
                    },
                  });
                }}
              >
                {deleteLot.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
