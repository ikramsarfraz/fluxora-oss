"use client";

import Link from "next/link";
import { useState } from "react";

import { useInventoryItem } from "../hooks/use-inventory";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { TablePagination } from "@/components/table-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";
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
import { InventoryItemActivityCard } from "./inventory-item-activity-card";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import {
  formatInventoryQuantity,
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

  // The actual URL is /inventory/items/<id>; the previous path was a legacy
  // /inventory/<id> route that no longer matches the breadcrumb's segment
  // key, so the override was silently ignored and the humanized UUID
  // ("9b66728b E984 4cfa…") leaked through. Provide a stable loading label
  // too so the UUID never renders even for the first paint.
  useSetBreadcrumbLabel(
    `/inventory/items/${inventoryItemId}`,
    item?.barcodeId ?? "Item",
  );

  // Pagination hooks live above the loading/error short-circuits to keep
  // the hook-call order stable across renders. Pass empty arrays as a
  // safe default when `item` is undefined; the hook produces a no-op
  // state that doesn't render any rows.
  const allocationsPagination = useClientPagination(
    item?.allocations ?? [],
    10,
  );
  const fulfillmentsPagination = useClientPagination(
    item?.fulfillments ?? [],
    10,
  );

  if (isLoading) {
    // Layout-matching skeleton:
    //   header + 3 metric cards (quantity / cost / allocations) + 3
    //   detail sections (adjustment actions, item details, lot+source) +
    //   2 tables (allocations, fulfillments) + activity card placeholder.
    return (
      <DetailPageSkeleton
        sections={3}
        metricCards={3}
        tables={2}
        activityCard
      />
    );
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

  // Unit label for "Unit cost" — historically "lb" or "case"; now also
  // covers per_each / per_unit by reading the line's snapshot
  // abbreviation when present, else falling back to the product's base
  // UOM, else the legacy lb/case mapping.
  const baseUnitAbbr = item.product?.baseUnit?.abbreviation ?? null;
  const costUnitLabel =
    item.costUnitTypeSnapshot === "fixed_case"
      ? "case"
      : item.costUnitTypeSnapshot === "per_each"
        ? baseUnitAbbr ?? "ea"
        : item.costUnitTypeSnapshot === "per_unit"
          ? baseUnitAbbr ?? "unit"
          : baseUnitAbbr ?? "lb";
  // Total inventory value: weight × per-lb for catch_weight; case-count ×
  // per-case for everything else (fixed_case / per_each / per_unit).
  const totalCostValue =
    item.costUnitTypeSnapshot === "catch_weight"
      ? Number(item.costPerUnitSnapshot) * Number(item.exactWeightLbs)
      : Number(item.costPerUnitSnapshot) * item.cases;
  // Renders "X.XX lb" / "5 ea" / "24 ea (1 cs)" depending on the
  // snapshot. Pack size lives on the inventory row now so multi-pack
  // cases display both the base-unit count and the case count.
  const quantityLabel = formatInventoryQuantity({
    costUnitTypeSnapshot: item.costUnitTypeSnapshot,
    exactWeightLbs: item.exactWeightLbs,
    cases: item.cases,
    unitsPerPackageSnapshot: item.unitsPerPackageSnapshot,
    baseUnitAbbreviation: baseUnitAbbr,
  });
  const isWeightItem =
    item.costUnitTypeSnapshot === "catch_weight" ||
    item.costUnitTypeSnapshot === "fixed_case" ||
    item.costUnitTypeSnapshot == null;

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={item.barcodeId}
        description="Inspect inbound source, warehouse lifecycle, and outbound usage for this inventory item."
        badge={<InventoryStatusBadge status={item.status} />}
        // The title is a barcode — render it in mono so it reads as a
        // copyable identifier, matching the orders / bills detail pages.
        variant="identifier"
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
              {isWeightItem ? "Exact weight" : "Quantity"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {quantityLabel}
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
          <DetailField label={isWeightItem ? "Exact weight" : "Quantity"}>
            {quantityLabel}
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
            <Link href={`/inventory/lots/${item.lot.id}`} className="hover:underline">
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
                {sourceReceiptLine.quantityCases.toLocaleString()} cases
                {/* Only render weight for weight-priced receipt lines.
                    Non-weight lines (cans, gal jugs) keep just the
                    case/unit count which is the meaningful metric there. */}
                {sourceReceiptLine.unitType === "catch_weight" ||
                sourceReceiptLine.unitType === "fixed_case" ? (
                  <>
                    {" "}
                    /{" "}
                    {formatWeightLbs(sourceReceiptLine.weightLbs)}{" "}
                    {sourceReceiptLine.product?.baseUnit?.abbreviation ?? "lb"}
                  </>
                ) : null}
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
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
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
                  {allocationsPagination.rows.map(allocation => (
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
            <TablePagination state={allocationsPagination} />
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
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    {isWeightItem ? (
                      <TableHead className="text-right">
                        Weight {baseUnitAbbr ?? "lb"}
                      </TableHead>
                    ) : null}
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Fulfilled at</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fulfillmentsPagination.rows.map(fulfillment => (
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
                    {isWeightItem ? (
                      <TableCell className="text-right tabular-nums">
                        {formatWeightLbs(fulfillment.weightLbs)}
                      </TableCell>
                    ) : null}
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
            <TablePagination state={fulfillmentsPagination} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No fulfillment rows are linked to this inventory item yet.
          </p>
        )}
      </DetailSection>

      {/* Shared ActivityCard — same surface used by order and supplier-invoice
          detail pages. The card renders its own "Activity" header and an
          expand-to-full toggle; no DetailSection wrapper needed. */}
      <InventoryItemActivityCard inventoryItemId={inventoryItemId} />

      <InventoryAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        item={item}
        disabledReason={adjustDisabledReason}
      />
    </div>
  );
}
