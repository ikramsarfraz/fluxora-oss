"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLot } from "../hooks/use-lots";
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
import { TablePagination } from "@/components/table-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";
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
  LotOperationalStatusBadge,
} from "@/modules/distribution/components/warehouse/warehouse-badges";
import { InventoryAdjustmentHistory } from "@/modules/distribution/components/warehouse/inventory-adjustment-history";
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
  isLotNonWeight,
} from "./lot-view-helpers";
import { LotExtendExpirationDialog } from "./lot-extend-expiration-dialog";
import { LotWriteOffDialog } from "./lot-write-off-dialog";

export function LotDetailPage({ lotId }: { lotId: string }) {
  const [extendExpirationOpen, setExtendExpirationOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const {
    data: lot,
    isLoading,
    error: loadError,
    isError,
  } = useLot(lotId);
  const { data: currentUser } = useCurrentPortalUser();

  // Lot detail is reachable from both /lots/<id> and /inventory/lots/<id>;
  // use the live pathname so the override key matches whichever URL the
  // user actually landed on (the breadcrumb component looks up overrides
  // by exact href). Also pass a stable loading label so the humanized
  // UUID never leaks through while `lot` is undefined.
  const pathname = usePathname();
  useSetBreadcrumbLabel(pathname ?? `/lots/${lotId}`, lot?.lotNumber ?? "Lot");

  // Pagination hooks for the three inline tables on this page. Defined
  // here (above the loading short-circuit) so the hook-call order stays
  // stable across renders; empty-array fallbacks make the pre-data
  // state a no-op.
  const receiptsPagination = useClientPagination(lot?.lotReceipts ?? [], 10);
  const inventoryItemsPagination = useClientPagination(
    lot?.inventoryItems ?? [],
    10,
  );
  const markdownsPagination = useClientPagination(
    lot?.markdownHistories ?? [],
    10,
  );

  if (isLoading) {
    // Match the lot detail layout: header + 3 metric cards + 3 detail
    // sections + inventory-items table + activity card. Without this
    // closeness the page jumps when real data arrives.
    return (
      <DetailPageSkeleton
        sections={3}
        metricCards={3}
        tables={1}
        activityCard
      />
    );
  }
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
  const writeOffEligibleItems = lot.inventoryItems.filter(item => {
    if (item.status === "shipped" || item.status === "sold" || item.status === "expired") return false;
    if (item.allocations.length > 0) return false;
    if (item.fulfillments.some(f => !f.reversedAt)) return false;
    return true;
  });
  const estimatedWriteOffValue = writeOffEligibleItems.reduce((sum, item) => {
    const cost = Number(item.costPerUnitSnapshot ?? 0);
    const value = item.costUnitTypeSnapshot === "fixed_case"
      ? cost * item.cases
      : cost * Number(item.exactWeightLbs ?? 0);
    return sum + value;
  }, 0);
  const writeOffDisabledReason = !canManageCorrections
    ? getWarehouseCorrectionDeniedReason()
    : writeOffEligibleItems.length === 0
      ? "No eligible inventory to write off in this lot."
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
        // Lot number is an identifier — mono treatment, same as the
        // orders / bills / inventory detail pages.
        variant="identifier"
      >
        <ExpirationStateBadge state={expirationState} />
        {(expirationState === "expiring_soon" || expirationState === "expired") && (
          <Link href={`/inventory/lots/${lot.id}/decide`}>
            <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
              Make disposition decision
            </Button>
          </Link>
        )}
      </DetailPageHeader>

      <div className="grid gap-4 md:grid-cols-3">
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
              {isLotNonWeight(lot) ? "Total units" : "Total weight"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {/* Mixed-UOM safe: weight lots show "X.XX lb", non-weight
                lots show their base-unit count (cases × pack). The
                secondary line shows the physical case count when the
                pack multiplies — so 5 cases of a 24-pack reads
                "120 ea / 5 cases". */}
            {isLotNonWeight(lot) ? (
              <>
                {totals.totalUnits.toLocaleString()}{" "}
                {product?.baseUnit?.abbreviation ?? "ea"}
                {totals.totalCases !== totals.totalUnits ? (
                  <div className="text-xs font-normal text-muted-foreground">
                    {totals.totalCases.toLocaleString()} cs
                  </div>
                ) : null}
              </>
            ) : (
              `${formatWeightLbs(totals.totalWeight)} ${product?.baseUnit?.abbreviation ?? "lb"}`
            )}
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
              {canManageCorrections && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setExtendExpirationOpen(true)}
                >
                  Extend
                </Button>
              )}
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
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-divider">
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
                  {receiptsPagination.rows.map(receipt => {
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
            <TablePagination state={receiptsPagination} />
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
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-divider">
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">
                      {isLotNonWeight(lot)
                        ? `Qty (${product?.baseUnit?.abbreviation ?? "ea"})`
                        : `Weight (${product?.baseUnit?.abbreviation ?? "lb"})`}
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Allocations</TableHead>
                    <TableHead className="text-right">Fulfillments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItemsPagination.rows.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/inventory/${item.id}`} className="hover:underline">
                          {item.barcodeId}
                        </Link>
                      </TableCell>
                      <TableCell>{item.product?.name ?? product?.name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {/* Per-item quantity — weight for catch/fixed,
                            case-count for per_each / per_unit (one item
                            row = one unit/case in the base UOM). */}
                        {item.costUnitTypeSnapshot === "per_each" ||
                        item.costUnitTypeSnapshot === "per_unit"
                          ? item.cases
                          : formatWeightLbs(item.exactWeightLbs)}
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
            <TablePagination state={inventoryItemsPagination} />
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

      {lot.markdownHistories.length > 0 && (
        <DetailSection
          title="Markdown outcomes"
          description="Recorded sell-through results for markdowns applied to this lot."
        >
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-divider">
                  <TableRow>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Qty offered</TableHead>
                    <TableHead className="text-right">Sell-through</TableHead>
                    <TableHead className="text-right">Expected net</TableHead>
                    <TableHead className="text-right">Actual net</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markdownsPagination.rows.map(mh => {
                  const expected = Number(mh.expectedNet ?? 0);
                  const actual = Number(mh.actualNet ?? 0);
                  const variance = actual - expected;
                  const fmt = (n: number) =>
                    n.toLocaleString("en-US", { style: "currency", currency: "USD" });
                  return (
                    <TableRow key={mh.id}>
                      <TableCell className="text-muted-foreground">
                        {mh.completedAt ? formatDisplayDate(mh.completedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(mh.discountPercent).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(mh.quantityOfferedLbs).toLocaleString("en-US", { maximumFractionDigits: 0 })} lb
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {mh.actualSellThroughPct != null
                          ? `${Number(mh.actualSellThroughPct).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {mh.expectedNet != null ? fmt(expected) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {mh.actualNet != null ? fmt(actual) : "—"}
                      </TableCell>
                      <TableCell
                        className={[
                          "text-right tabular-nums font-medium",
                          variance > 0
                            ? "text-green-600"
                            : variance < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {mh.expectedNet != null && mh.actualNet != null
                          ? `${variance >= 0 ? "+" : ""}${fmt(variance)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
            <TablePagination state={markdownsPagination} />
          </div>
        </DetailSection>
      )}

      <DetailSection
        title="Write off as loss"
        description="Mark all eligible inventory in this lot as expired and record the cost as an expense."
        footer={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setWriteOffOpen(true)}
            disabled={Boolean(writeOffDisabledReason)}
            title={writeOffDisabledReason ?? undefined}
          >
            Write off and record loss
          </Button>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            This marks all non-allocated, non-fulfilled inventory in this lot as expired and
            creates an &quot;Inventory write-off&quot; expense entry for the total cost value.
          </p>
          {writeOffDisabledReason ? (
            <p className="font-medium text-destructive">{writeOffDisabledReason}</p>
          ) : (
            <p>
              {writeOffEligibleItems.length} item(s) eligible for write-off with an estimated
              loss of <span className="font-medium text-foreground">{estimatedWriteOffValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>.
            </p>
          )}
        </div>
      </DetailSection>

      <DetailSection
        title="Reverse receipt"
        description="Undo this lot by reversing its source supplier invoice."
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Lots are created when a supplier invoice is completed. To remove this lot and its
            inventory, reverse the receipt on the source invoice — this resets the invoice to
            draft and deletes the lot and any untouched inventory in one transaction.
          </p>
          <p>
            Reversal is blocked if any inventory in the lot has been allocated, fulfilled,
            shipped, sold, or written off.
          </p>
          {sourceInvoices.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {sourceInvoices.map(invoice => (
                <Button key={invoice.id} asChild variant="outline" size="sm">
                  <Link href={`/supplier-invoices/${invoice.id}`}>
                    Open {invoice.invoiceNumber} to reverse
                  </Link>
                </Button>
              ))}
            </div>
          ) : (
            <p className="font-medium text-foreground">No source invoice linked to this lot.</p>
          )}
        </div>
      </DetailSection>

      <LotExtendExpirationDialog
        open={extendExpirationOpen}
        onOpenChange={setExtendExpirationOpen}
        lotId={lot.id}
        lotNumber={lot.lotNumber}
        currentExpirationDate={lot.expirationDate}
      />
      <LotWriteOffDialog
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        lotId={lot.id}
        lotNumber={lot.lotNumber}
        eligibleItemCount={writeOffEligibleItems.length}
        estimatedLossValue={estimatedWriteOffValue}
        disabledReason={writeOffDisabledReason}
      />
    </div>
  );
}
