"use client";

import Link from "next/link";
import { useState } from "react";

import { useInventoryItem } from "../hooks/use-inventory";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
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
} from "@/modules/distribution/components/warehouse/warehouse-badges";
import { InventoryAdjustmentHistory } from "@/modules/distribution/components/warehouse/inventory-adjustment-history";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import {
  formatWeightLbs,
  getExpirationState,
} from "../utils/insights";
import {
  canManageWarehouseCorrections,
  getWarehouseCorrectionDeniedReason,
} from "../utils/action-permissions";
import { getInventoryAdjustmentDisabledReason } from "../utils/adjustment-rules";

import { InventoryAdjustmentDialog } from "./inventory-adjustment-dialog";

function actorLabel(user: {
  fullName: string | null;
  email: string | null;
} | null | undefined) {
  return user?.fullName ?? user?.email ?? "System";
}

export function InventoryDetailPage({
  inventoryItemId,
}: {
  inventoryItemId: string;
}) {
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const { data: item, isLoading, error, isError } =
    useInventoryItem(inventoryItemId);
  const { data: currentUser } = useCurrentPortalUser();

  useSetBreadcrumbLabel(`/inventory/${inventoryItemId}`, item?.barcodeId);

  if (isLoading) {
    return <DetailPageSkeleton includeTable />;
  }

  if (isError || !item) {
    return (
      <PageError
        message={
          error ? (error as Error).message : "Inventory item not found."
        }
      />
    );
  }

  const expirationState = getExpirationState(item.lot.expirationDate);
  const sourceInvoice =
    item.lot.lotReceipts[0]?.supplierInvoiceLine?.supplierInvoice ?? null;
  const sourceReceiptLine = item.lot.lotReceipts[0]?.supplierInvoiceLine ?? null;
  const activeFulfillments = item.fulfillments.filter(
    fulfillment => !fulfillment.reversedAt,
  );
  const relatedOrders = new Set([
    ...item.allocations.map(allocation => allocation.salesOrderLine.salesOrder.id),
    ...item.fulfillments.map(fulfillment => fulfillment.salesOrder.id),
  ]);
  const canAdjust = canManageWarehouseCorrections(currentUser?.role);
  const workflowAdjustmentBlockedReason = getInventoryAdjustmentDisabledReason({
    status: item.status,
    allocationCount: item.allocations.length,
    activeFulfillmentCount: activeFulfillments.length,
  });
  const adjustDisabledReason =
    !canAdjust
      ? getWarehouseCorrectionDeniedReason()
      : workflowAdjustmentBlockedReason;

  const costUnitLabel = item.costUnitTypeSnapshot === "fixed_case" ? "case" : "lb";
  const totalCostValue =
    item.costUnitTypeSnapshot === "fixed_case"
      ? Number(item.costPerUnitSnapshot) * item.cases
      : Number(item.costPerUnitSnapshot) * Number(item.exactWeightLbs);

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={item.barcodeId}
        description="Inspect inbound source, warehouse lifecycle, and outbound usage for this inventory item."
        badge={<InventoryStatusBadge status={item.status} />}
      >
        <ExpirationStateBadge state={expirationState} />
      </DetailPageHeader>

      <DetailSection
        title="Adjustment actions"
        description="Record controlled stock corrections instead of editing inventory inline."
        footer={
          <Button
            type="button"
            onClick={() => setAdjustDialogOpen(true)}
            disabled={Boolean(adjustDisabledReason)}
            title={adjustDisabledReason ?? undefined}
          >
            Adjust inventory
          </Button>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Use this workflow to mark inventory damaged or expired, return it to
            stock, or correct the weight with a recorded reason.
          </p>
          {adjustDisabledReason ? (
            <p className="font-medium text-destructive">{adjustDisabledReason}</p>
          ) : (
            <p>
              This item is eligible for controlled correction because it is not
              currently locked by outbound workflow state.
            </p>
          )}
        </div>
      </DetailSection>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Exact weight
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatWeightLbs(item.exactWeightLbs)} lb
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost value
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(totalCostValue.toFixed(2))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active allocations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {item.allocations.length}
          </CardContent>
        </Card>
      </div>

      <DetailSection
        title="Inventory summary"
        description="Core product, stock, and lifecycle details."
      >
        <DetailGrid className="lg:grid-cols-3">
          <DetailField label="Product">
            <Link href={`/products/${item.product.id}`} className="hover:underline">
              {item.product.name}
            </Link>
          </DetailField>
          <DetailField label="SKU">
            <span className="font-mono text-sm">{item.product.sku}</span>
          </DetailField>
          <DetailField label="Barcode / inventory ID">
            <span className="font-mono text-sm">{item.barcodeId}</span>
          </DetailField>
          <DetailField label="Exact weight">
            {formatWeightLbs(item.exactWeightLbs)} lb
          </DetailField>
          <DetailField label="Unit cost">
            {formatMoney(item.costPerUnitSnapshot)} / {costUnitLabel}
          </DetailField>
          <DetailField label="Status">
            <InventoryStatusBadge status={item.status} />
          </DetailField>
          <DetailField label="Created">
            {new Date(item.createdAt).toLocaleString()}
          </DetailField>
          <DetailField label="Last updated">
            {new Date(item.updatedAt).toLocaleString()}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Lot and source"
        description="Where this inventory came from and when it expires."
      >
        <DetailGrid className="lg:grid-cols-3">
          <DetailField label="Lot number">
            <Link href={`/lots/${item.lot.id}`} className="hover:underline">
              {item.lot.lotNumber}
            </Link>
          </DetailField>
          <DetailField label="Supplier">
            {item.lot.supplier ? (
              <Link
                href={`/suppliers/${item.lot.supplier.id}`}
                className="hover:underline"
              >
                {item.lot.supplier.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </DetailField>
          <DetailField label="Expiration">
            <div className="flex flex-wrap items-center gap-2">
              <span>{formatDisplayDate(item.lot.expirationDate)}</span>
              <ExpirationStateBadge state={expirationState} />
            </div>
          </DetailField>
          <DetailField label="Receive date">
            {formatDisplayDate(item.lot.receiveDate)}
          </DetailField>
          <DetailField label="Supplier invoice">
            {sourceInvoice ? (
              <Link
                href={`/supplier-invoices/${sourceInvoice.id}`}
                className="hover:underline"
              >
                {sourceInvoice.invoiceNumber}
              </Link>
            ) : (
              <span className="text-muted-foreground">Not linked</span>
            )}
          </DetailField>
          <DetailField label="Receipt line">
            {sourceReceiptLine ? (
              <span>
                {sourceReceiptLine.quantityCases.toLocaleString()} cases /{" "}
                {formatWeightLbs(sourceReceiptLine.weightLbs)} lb
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Traceability"
        description="Follow this inventory item from receiving through outbound demand."
      >
        <DetailGrid className="lg:grid-cols-4">
          <DetailField label="Related orders">{relatedOrders.size}</DetailField>
          <DetailField label="Current allocations">
            {item.allocations.length}
          </DetailField>
          <DetailField label="Active fulfillment rows">
            {activeFulfillments.length}
          </DetailField>
          <DetailField label="Reversed fulfillment rows">
            {item.fulfillments.length - activeFulfillments.length}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Allocations"
        description="Sales order lines currently reserving this inventory item."
      >
        {item.allocations.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Fulfilled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allocated at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.allocations.map(allocation => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${allocation.salesOrderLine.salesOrder.id}`}
                        className="hover:underline"
                      >
                        {allocation.salesOrderLine.salesOrder.orderNumber ??
                          allocation.salesOrderLine.salesOrder.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {allocation.salesOrderLine.salesOrder.customer?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {allocation.salesOrderLine.product?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {allocation.salesOrderLine.expectedCases}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {allocation.salesOrderLine.fulfilledCases}
                    </TableCell>
                    <TableCell>
                      {allocation.salesOrderLine.shortShippedAt
                        ? "Short shipped"
                        : "Open"}
                    </TableCell>
                    <TableCell>
                      {new Date(allocation.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This inventory item is not currently allocated to any sales order.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Fulfillment history"
        description="Outbound fulfillment rows linked to this inventory item."
      >
        {item.fulfillments.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Weight lbs</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Fulfilled at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.fulfillments.map(fulfillment => (
                  <TableRow key={fulfillment.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${fulfillment.salesOrder.id}`}
                        className="hover:underline"
                      >
                        {fulfillment.salesOrder.orderNumber ??
                          fulfillment.salesOrder.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {fulfillment.salesOrder.customer?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fulfillment.quantityFulfilled.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatWeightLbs(fulfillment.weightLbs)}
                    </TableCell>
                    <TableCell>{actorLabel(fulfillment.fulfilledBy)}</TableCell>
                    <TableCell>
                      {new Date(fulfillment.fulfilledAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {fulfillment.reversedAt ? "Reversed" : "Active"}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs text-sm text-muted-foreground">
                        {fulfillment.reversedAt
                          ? fulfillment.reversalReason ?? "No reversal reason"
                          : fulfillment.notes ?? "-"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No fulfillment rows are linked to this inventory item yet.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Adjustment history"
        description="Warehouse correction records for this inventory item."
      >
        <InventoryAdjustmentHistory adjustments={item.adjustments} />
      </DetailSection>

      <InventoryAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        item={item}
        disabledReason={adjustDisabledReason}
      />
    </div>
  );
}
