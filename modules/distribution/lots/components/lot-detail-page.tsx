"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useLot, useDeleteLot } from "../hooks/use-lots";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { queryKeys } from "@/lib/query/keys";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExpirationStateBadge,
  InventoryStatusBadge,
  LotOperationalStatusBadge,
} from "@/components/warehouse/warehouse-badges";
import { InventoryAdjustmentHistory } from "@/components/warehouse/inventory-adjustment-history";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  formatWeightLbs,
  getExpirationState,
  getLotOperationalStatus,
} from "@/lib/warehouse/insights";
import {
  canManageWarehouseCorrections,
  getWarehouseCorrectionDeniedReason,
} from "@/lib/warehouse/action-permissions";
import { getInventoryAdjustmentDisabledReason } from "@/lib/warehouse/adjustment-rules";

import {
  getLotPrimaryProduct,
  getLotSourceInvoices,
  getLotTotals,
} from "./lot-view-helpers";
import { LotBulkAdjustmentDialog } from "./lot-bulk-adjustment-dialog";

export function LotDetailPage({ lotId }: { lotId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [damageDialogOpen, setDamageDialogOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  const {
    data: lot,
    isLoading,
    error: loadError,
    isError,
  } = useLot(lotId);
  const { data: currentUser } = useCurrentPortalUser();

  useSetBreadcrumbLabel(`/lots/${lotId}`, lot?.lotNumber);

  const deleteLot = useDeleteLot();

  if (isLoading) return <DetailPageSkeleton includeTable />;
  if (isError || !lot) {
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Lot not found."}
      />
    );
  }

  const product = getLotPrimaryProduct(lot);
  const sourceInvoices = getLotSourceInvoices(lot);
  const totals = getLotTotals(lot);
  const expirationState = getExpirationState(lot.expirationDate);
  const lotStatus = getLotOperationalStatus({
    inventoryStatuses: totals.statuses,
    expirationDate: lot.expirationDate,
  });
  const allocatedOrders = new Set(
    lot.inventoryItems.flatMap(item =>
      item.allocations.map(allocation => allocation.salesOrderLine.salesOrder.id),
    ),
  );
  const fulfilledOrders = new Set(
    lot.inventoryItems.flatMap(item =>
      item.fulfillments.map(fulfillment => fulfillment.salesOrder.id),
    ),
  );
  const lotActionPreview = (() => {
    let adjustableCount = 0;
    let lockedCount = 0;

    for (const item of lot.inventoryItems) {
      const reason = getInventoryAdjustmentDisabledReason({
        status: item.status,
        allocationCount: item.allocations.length,
        activeFulfillmentCount: item.fulfillments.filter(
          fulfillment => !fulfillment.reversedAt,
        ).length,
      });

      if (reason) {
        lockedCount += 1;
      } else {
        adjustableCount += 1;
      }
    }

    return { adjustableCount, lockedCount };
  })();
  const canManageCorrections = canManageWarehouseCorrections(currentUser?.role);
  const lotActionDisabledReason = !canManageCorrections
    ? getWarehouseCorrectionDeniedReason()
    : lotActionPreview.adjustableCount === 0
      ? "No inventory in this lot is eligible for bulk correction."
      : null;
  const recentAdjustments = lot.inventoryItems
    .flatMap(item =>
      item.adjustments.map(adjustment => ({
        ...adjustment,
        inventoryItemId: item.id,
        barcodeId: item.barcodeId,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={lot.lotNumber}
        description="Inspect inbound lot traceability, linked inventory, expiration risk, and outbound usage."
        badge={<LotOperationalStatusBadge status={lotStatus} />}
      >
        <ExpirationStateBadge state={expirationState} />
      </DetailPageHeader>

      <DetailSection
        title="Lot actions"
        description="Run practical warehouse corrections across eligible inventory in this lot."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpireDialogOpen(true)}
              disabled={Boolean(lotActionDisabledReason)}
              title={lotActionDisabledReason ?? undefined}
            >
              Mark eligible inventory expired
            </Button>
            <Button
              type="button"
              onClick={() => setDamageDialogOpen(true)}
              disabled={Boolean(lotActionDisabledReason)}
              title={lotActionDisabledReason ?? undefined}
            >
              Mark eligible inventory damaged
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Lot actions only affect inventory that is not allocated, not part of
            active fulfillment, and not already shipped or sold.
          </p>
          <p>
            Eligible inventory: <span className="font-medium text-foreground">{lotActionPreview.adjustableCount}</span>
            {" "} / Locked inventory: <span className="font-medium text-foreground">{lotActionPreview.lockedCount}</span>
          </p>
          {lotActionDisabledReason ? (
            <p className="font-medium text-destructive">{lotActionDisabledReason}</p>
          ) : null}
        </div>
      </DetailSection>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inventory items
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {totals.inventoryItemCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total cases
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {totals.totalCases}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total weight
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatWeightLbs(totals.totalWeight)} lb
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Linked invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {sourceInvoices.length}
          </CardContent>
        </Card>
      </div>

      <DetailSection
        title="Lot summary"
        description="Core source, supplier, and expiration details."
      >
        <DetailGrid className="lg:grid-cols-3">
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
          <DetailField label="Product">
            {product ? (
              <Link href={`/products/${product.id}`} className="hover:underline">
                {product.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Mixed / unknown</span>
            )}
          </DetailField>
          <DetailField label="SKU">
            {product?.sku ? (
              <span className="font-mono text-sm">{product.sku}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </DetailField>
          <DetailField label="Receive date">
            {formatDisplayDate(lot.receiveDate)}
          </DetailField>
          <DetailField label="Expiration">
            <div className="flex flex-wrap items-center gap-2">
              <span>{formatDisplayDate(lot.expirationDate)}</span>
              <ExpirationStateBadge state={expirationState} />
            </div>
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Traceability summary"
        description="Quick view of inbound and outbound touchpoints for this lot."
      >
        <DetailGrid className="lg:grid-cols-4">
          <DetailField label="Linked supplier invoices">
            {sourceInvoices.length}
          </DetailField>
          <DetailField label="Allocated orders">
            {allocatedOrders.size}
          </DetailField>
          <DetailField label="Fulfilled orders">
            {fulfilledOrders.size}
          </DetailField>
          <DetailField label="Lot status">
            <LotOperationalStatusBadge status={lotStatus} />
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Source receipts"
        description="Supplier invoices that created this lot."
      >
        {sourceInvoices.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Invoice date</TableHead>
                  <TableHead>Receive date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lot.lotReceipts.map(receipt => {
                  const invoice = receipt.supplierInvoiceLine?.supplierInvoice;
                  const receiptProduct = receipt.supplierInvoiceLine?.product;
                  if (!invoice) return null;

                  return (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        <Link
                          href={`/supplier-invoices/${invoice.id}`}
                          className="hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.supplier?.name ?? "-"}</TableCell>
                      <TableCell>{receiptProduct?.name ?? "-"}</TableCell>
                      <TableCell>{formatDisplayDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>{formatDisplayDate(invoice.receiveDate)}</TableCell>
                      <TableCell className="capitalize">{invoice.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This lot is not currently linked to a supplier invoice receipt.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Inventory in this lot"
        description="All inventory items currently tied to this lot."
      >
        {lot.inventoryItems.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right">Weight lbs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Allocations</TableHead>
                  <TableHead className="text-right">Fulfillments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lot.inventoryItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`} className="hover:underline">
                        {item.barcodeId}
                      </Link>
                    </TableCell>
                    <TableCell>{item.product?.name ?? product?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.cases}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatWeightLbs(item.exactWeightLbs)}
                    </TableCell>
                    <TableCell>
                      <InventoryStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.allocations.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {
                        item.fulfillments.filter(fulfillment => !fulfillment.reversedAt)
                          .length
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No inventory items are currently tied to this lot.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Expiration and traceability"
        description="Operational warnings and outbound traceability for this lot."
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {expirationState === "expired"
              ? "This lot is expired. Review any remaining open or allocated inventory immediately."
              : expirationState === "expiring_soon"
                ? "This lot is expiring soon. Prioritize FEFO handling for any remaining stock."
                : "This lot is within its freshness window based on the current expiration date."}
          </p>
          <p className="text-muted-foreground">
            {allocatedOrders.size > 0 || fulfilledOrders.size > 0
              ? `This lot has touched ${allocatedOrders.size} allocated order${allocatedOrders.size === 1 ? "" : "s"} and ${fulfilledOrders.size} fulfilled order${fulfilledOrders.size === 1 ? "" : "s"}.`
              : "This lot has not yet been allocated or fulfilled outbound."}
          </p>
          {lotActionPreview.lockedCount > 0 ? (
            <p className="text-muted-foreground">
              Some inventory in this lot is locked by downstream workflow and
              will be skipped by bulk lot actions.
            </p>
          ) : null}
        </div>
      </DetailSection>

      <DetailSection
        title="Adjustment history"
        description="Recent corrections recorded against inventory in this lot."
      >
        <InventoryAdjustmentHistory
          adjustments={recentAdjustments}
          emptyMessage="No lot-related inventory adjustments recorded yet."
        />
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
                {deleteLot.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>

      <LotBulkAdjustmentDialog
        open={expireDialogOpen}
        onOpenChange={setExpireDialogOpen}
        lotId={lot.id}
        lotNumber={lot.lotNumber}
        adjustableCount={lotActionPreview.adjustableCount}
        lockedCount={lotActionPreview.lockedCount}
        defaultTargetStatus="expired"
        disabledReason={lotActionDisabledReason}
      />
      <LotBulkAdjustmentDialog
        open={damageDialogOpen}
        onOpenChange={setDamageDialogOpen}
        lotId={lot.id}
        lotNumber={lot.lotNumber}
        adjustableCount={lotActionPreview.adjustableCount}
        lockedCount={lotActionPreview.lockedCount}
        defaultTargetStatus="damaged"
        disabledReason={lotActionDisabledReason}
      />
    </div>
  );
}
