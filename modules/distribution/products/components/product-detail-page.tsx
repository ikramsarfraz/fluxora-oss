"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { Line, LineChart, ReferenceDot, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

import {
  useArchiveProduct,
  usePermanentlyDeleteProduct,
  useProduct,
  useProductActivity,
  useProductCustomerPrices,
  useProductInventorySummary,
  useProductPurchaseIntelligence,
  useProductRecentPurchases,
  useRestoreProduct,
} from "../hooks/use-products";
import { ActivityCard } from "@/modules/distribution/components/activity-card";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import {
  formatProductDefaultPrice,
  getProductBaseUnitAbbreviation,
} from "../utils/product-uom";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney, formatWeightLbs } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TablePagination } from "@/components/table-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { SkuIntelligenceEmptyState } from "@/modules/distribution/components/empty-states";
import {
  PRICE_DRIFT_ALERT_PCT,
  classifyDriftBand,
} from "../utils/price-intelligence-thresholds";

const PURPOSE_LABELS: Record<string, string> = {
  stock: "Stock",
  purchase: "Purchase",
  sales: "Sales",
  pricing: "Pricing",
  display: "Display",
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  catch_weight: "by weight",
  fixed_case: "fixed case",
  per_each: "per each",
  per_unit: "per unit",
};

// ── Detail-page sections ────────────────────────────────────────────────────
// Each section is its own data-driven block with its own React Query
// fetch. The detail page header renders immediately; these stream in as
// their queries resolve, so a heavy inventory aggregation doesn't gate
// the page from showing up.

/**
 * Inventory snapshot — three bucket totals (on hand / in motion /
 * problem) + a lot-count badge on the headline. Renders a quiet
 * skeleton row while loading and a "No inventory yet" line when the
 * product has never been received.
 */
function ProductInventorySection({
  productId,
  baseUnitAbbreviation,
}: {
  productId: string;
  baseUnitAbbreviation: string;
}) {
  const { data: summary, isLoading } = useProductInventorySummary(productId);

  // Total rows across all three buckets — used to short-circuit to a
  // friendly empty state when the product has never had stock.
  const totalCases = summary
    ? summary.onHand.cases + summary.inMotion.cases + summary.problem.cases
    : 0;
  const isEmpty = !isLoading && summary && totalCases === 0;

  return (
    <DetailSection
      title="Inventory"
      description={
        summary && summary.onHandLotCount > 0
          ? `${summary.onHandLotCount} lot${summary.onHandLotCount === 1 ? "" : "s"} on hand.`
          : "Snapshot of current stock by status."
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading inventory…</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No inventory recorded for this product yet.
        </p>
      ) : summary ? (
        <DetailGrid>
          <InventoryBucket
            label="On hand"
            cases={summary.onHand.cases}
            weightLbs={summary.onHand.weightLbs}
            unitAbbr={baseUnitAbbreviation}
            tone="default"
          />
          <InventoryBucket
            label="In motion"
            cases={summary.inMotion.cases}
            weightLbs={summary.inMotion.weightLbs}
            unitAbbr={baseUnitAbbreviation}
            tone="default"
          />
          <InventoryBucket
            label="Damaged / expired"
            cases={summary.problem.cases}
            weightLbs={summary.problem.weightLbs}
            unitAbbr={baseUnitAbbreviation}
            tone={summary.problem.cases > 0 ? "warning" : "default"}
          />
        </DetailGrid>
      ) : null}
    </DetailSection>
  );
}

function InventoryBucket({
  label,
  cases,
  weightLbs,
  unitAbbr,
  tone,
}: {
  label: string;
  cases: number;
  weightLbs: string;
  unitAbbr: string;
  tone: "default" | "warning";
}) {
  const weight = Number(weightLbs);
  const hasWeight = Number.isFinite(weight) && weight > 0;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "warning"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border-default",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono tabular-nums text-base font-medium">
        {cases} {cases === 1 ? "case" : "cases"}
      </p>
      {hasWeight ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatWeightLbs(weightLbs)} {unitAbbr}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Last 5 supplier bills referencing this product. Useful for "what
 * did we pay last time" and "how does that compare to the running
 * average" at a glance.
 */
function ProductRecentPurchasesSection({
  productId,
  baseUnitAbbreviation,
}: {
  productId: string;
  baseUnitAbbreviation: string;
}) {
  const { data: purchases, isLoading } = useProductRecentPurchases(productId);
  // Pagination hides itself when total <= page size, so this stays clean
  // when the server is returning the 5-row preview but still works if the
  // query is later widened to return the full purchase history.
  const purchasesPagination = useClientPagination(purchases ?? [], 10);

  return (
    <DetailSection
      title="Recent purchases"
      description="Last 5 supplier bills that included this product."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading purchases…</p>
      ) : !purchases || purchases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This product hasn’t appeared on a supplier bill yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchasesPagination.rows.map(p => (
                <TableRow key={p.lineId}>
                  <TableCell className="font-mono tabular-nums text-xs">
                    {formatDisplayDate(p.invoiceDate)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/suppliers/${p.supplierId}`}
                      className="hover:underline"
                    >
                      {p.supplierName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/supplier-invoices/${p.invoiceId}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {p.referenceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {UNIT_TYPE_LABELS[p.unitType] ?? p.unitType}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(p.unitPrice)}
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      /{baseUnitAbbreviation}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                    {/* Show whichever quantity dimension is meaningful for
                        the line. catch_weight rows track weight; the
                        others (per_each / fixed_case) track cases. */}
                    {p.unitType === "catch_weight"
                      ? `${formatWeightLbs(p.weightLbs)} ${baseUnitAbbreviation}`
                      : `${p.quantityCases} cs`}
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination state={purchasesPagination} />
        </div>
      )}
    </DetailSection>
  );
}

/**
 * Customers that have a product-specific price override. Useful for
 * "who pays what" reference and as a guard before changing the
 * product's default price.
 */
function ProductCustomerPricesSection({
  productId,
  baseUnitAbbreviation,
}: {
  productId: string;
  baseUnitAbbreviation: string;
}) {
  const { data: prices, isLoading } = useProductCustomerPrices(productId);
  const pricesPagination = useClientPagination(prices ?? [], 10);

  return (
    <DetailSection
      title="Customer pricing"
      description={
        prices && prices.length > 0
          ? `${prices.length} customer${prices.length === 1 ? "" : "s"} have a custom price for this product.`
          : "Customers without an override use the default price above."
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading customer prices…</p>
      ) : !prices || prices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No customer-specific overrides yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Supplier scope</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricesPagination.rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="hover:underline"
                    >
                      {row.customerName}
                    </Link>
                    {row.customerArchivedAt ? (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 rounded-full px-1.5 text-[10px] uppercase tracking-wide"
                      >
                        Archived
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.supplierName ?? "Any supplier"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(row.pricePerLb)}
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      /{baseUnitAbbreviation}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                    {formatDisplayDate(row.updatedAt)}
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination state={pricesPagination} />
        </div>
      )}
    </DetailSection>
  );
}

/**
 * MVP price intelligence. Three signals:
 *   1. running average unit cost
 *   2. most recent unit cost
 *   3. delta of (2) vs. (1), as a percentage
 *
 * Below the 3-purchase threshold we still show the empty state — a
 * baseline isn't meaningful with 1 or 2 data points. Above it, we
 * surface the running stats. Drift alerts, per-supplier breakdown,
 * and sparklines are tracked separately as future work (see GH issue).
 */
function ProductPriceIntelligenceSection({
  productId,
  productName,
  baseUnitAbbreviation,
}: {
  productId: string;
  productName: string;
  baseUnitAbbreviation: string;
}) {
  const { data: intel, isLoading } = useProductPurchaseIntelligence(productId);

  if (isLoading) {
    return (
      <DetailSection
        title="Price intelligence"
        description="Running cost average and most-recent purchase."
      >
        <p className="text-sm text-muted-foreground">Loading intelligence…</p>
      </DetailSection>
    );
  }

  // Below the 3-purchase threshold OR no purchases at all — show the
  // existing empty state. Keeps the UX consistent with the prior gate
  // while we ship more sophisticated drift signalling later.
  if (!intel || intel.purchaseCount < 3) {
    return (
      <DetailSection
        title="Price intelligence"
        description="Unlocks after 3 purchases — enough to establish a baseline average and flag drift."
      >
        <SkuIntelligenceEmptyState
          purchaseCount={intel?.purchaseCount ?? 0}
          productName={productName}
        />
      </DetailSection>
    );
  }

  const deltaPct =
    intel.deltaFraction != null ? intel.deltaFraction * 100 : null;
  const driftBand = classifyDriftBand(intel.deltaFraction);
  // Headline tone: alert = red, drift = orange/destructive, flat = muted.
  // The sign still picks positive (= paying less) vs warning (paying more)
  // when we're past the noise floor; below it everything stays muted.
  const deltaTone =
    deltaPct == null || driftBand === "flat"
      ? "muted"
      : deltaPct > 0
        ? "warning"
        : "positive";
  const deltaSign = deltaPct != null && deltaPct >= 0 ? "+" : "";
  // Any supplier in the alert band lights the banner — the global delta
  // can dilute supplier-level signal (e.g. Supplier A +20%, B flat → only
  // ~10% global, but A still needs attention).
  const supplierAlerts = intel.bySupplier.filter(
    s => classifyDriftBand(s.deltaFraction) === "alert",
  );
  const showAlertBanner = driftBand === "alert" || supplierAlerts.length > 0;

  return (
    <DetailSection
      title="Price intelligence"
      description={`${intel.purchaseCount} purchase${intel.purchaseCount === 1 ? "" : "s"} on record${intel.outlierCount > 0 ? ` · ${intel.outlierCount} excluded as possible outlier${intel.outlierCount === 1 ? "" : "s"}` : ""}.`}
    >
      {showAlertBanner ? (
        <PriceDriftAlertBanner
          globalBand={driftBand}
          globalDeltaPct={deltaPct}
          supplierAlerts={supplierAlerts}
        />
      ) : null}

      <DetailGrid>
        <DetailField label={`Average unit cost / ${baseUnitAbbreviation}`}>
          <span className="font-mono tabular-nums">
            {formatMoney(intel.averageUnitPrice)}
          </span>
        </DetailField>
        <DetailField label="Most recent unit cost">
          <span className="font-mono tabular-nums">
            {intel.mostRecentUnitPrice
              ? formatMoney(intel.mostRecentUnitPrice)
              : "—"}
          </span>
          {intel.mostRecentDate ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {formatDisplayDate(intel.mostRecentDate)}
            </span>
          ) : null}
        </DetailField>
        <DetailField label="Delta vs. average">
          <span
            className={cn(
              "font-mono tabular-nums",
              deltaTone === "warning" && "text-destructive",
              deltaTone === "positive" && "text-forest-mid",
              deltaTone === "muted" && "text-muted-foreground",
            )}
          >
            {deltaPct == null
              ? "—"
              : `${deltaSign}${deltaPct.toFixed(1)}%`}
          </span>
        </DetailField>
      </DetailGrid>

      {intel.series.length >= 2 ? (
        <PriceSparkline series={intel.series} />
      ) : null}

      {intel.bySupplier.length > 1 ? (
        <PerSupplierBreakdown
          rows={intel.bySupplier}
          baseUnitAbbreviation={baseUnitAbbreviation}
        />
      ) : null}
    </DetailSection>
  );
}

/**
 * Banner-level callout when a price has moved past the alert threshold
 * (defined in the threshold util — currently 15%). Surfaces global drift
 * and any supplier-level alerts so the user can spot which vendor is
 * driving the movement without scrolling to the per-supplier table.
 */
function PriceDriftAlertBanner({
  globalBand,
  globalDeltaPct,
  supplierAlerts,
}: {
  globalBand: "flat" | "drift" | "alert";
  globalDeltaPct: number | null;
  supplierAlerts: Array<{
    supplierName: string;
    deltaFraction: number | null;
  }>;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex flex-wrap items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]"
      style={{ color: "var(--color-forest-mid)" }}
    >
      <AlertTriangle
        className="mt-[2px] size-3.5 shrink-0 text-destructive"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">
          {globalBand === "alert" && globalDeltaPct != null
            ? `Price moved ${globalDeltaPct >= 0 ? "+" : ""}${globalDeltaPct.toFixed(1)}% vs. average — past the ${PRICE_DRIFT_ALERT_PCT}% alert threshold.`
            : `One or more suppliers moved past the ${PRICE_DRIFT_ALERT_PCT}% alert threshold.`}
        </div>
        {supplierAlerts.length > 0 ? (
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {supplierAlerts
              .map(s => {
                const pct =
                  s.deltaFraction != null ? s.deltaFraction * 100 : null;
                const sign = pct != null && pct >= 0 ? "+" : "";
                return `${s.supplierName} ${pct != null ? `${sign}${pct.toFixed(1)}%` : "—"}`;
              })
              .join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Minimal inline sparkline — last N purchases left-to-right, oldest to
 * newest. No axes, no grid, no tooltip header — it's a snapshot, not a
 * chart. Outlier purchases are highlighted with a red dot so the user
 * can spot a probable bad row without opening the recent-purchases
 * table below.
 */
function PriceSparkline({
  series,
}: {
  series: Array<{
    invoiceDate: string;
    unitPrice: string;
    isOutlier: boolean;
  }>;
}) {
  const data = series.map((row, idx) => ({
    idx,
    price: Number(row.unitPrice),
    isOutlier: row.isOutlier,
  }));
  const outliers = data.filter(d => d.isOutlier);
  return (
    <div
      className="mt-3 h-12 w-full"
      aria-label={`Unit cost across the last ${series.length} purchases`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--color-forest-mid)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {outliers.map(o => (
            <ReferenceDot
              key={o.idx}
              x={o.idx}
              y={o.price}
              r={3}
              fill="var(--destructive)"
              stroke="none"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Per-supplier breakdown table — same shape as the headline stats but
 * one row per supplier. Sorted server-side by |delta| descending so the
 * loudest movers are on top. Only renders when there's more than one
 * supplier — a single supplier in the table would just duplicate the
 * headline numbers above.
 */
function PerSupplierBreakdown({
  rows,
  baseUnitAbbreviation,
}: {
  rows: Array<{
    supplierId: string;
    supplierName: string;
    count: number;
    averageUnitPrice: string | null;
    mostRecentUnitPrice: string;
    mostRecentDate: string;
    deltaFraction: number | null;
  }>;
  baseUnitAbbreviation: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border-default">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Purchases</TableHead>
            <TableHead className="text-right">
              Avg / {baseUnitAbbreviation}
            </TableHead>
            <TableHead className="text-right">Most recent</TableHead>
            <TableHead className="text-right">Δ vs. avg</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const pct =
              row.deltaFraction != null ? row.deltaFraction * 100 : null;
            const band = classifyDriftBand(row.deltaFraction);
            const sign = pct != null && pct >= 0 ? "+" : "";
            return (
              <TableRow key={row.supplierId}>
                <TableCell className="font-medium">{row.supplierName}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.count}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.averageUnitPrice
                    ? formatMoney(row.averageUnitPrice)
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono tabular-nums">
                    {formatMoney(row.mostRecentUnitPrice)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDisplayDate(row.mostRecentDate)}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    band === "alert" && "text-destructive",
                    band === "drift" &&
                      (pct != null && pct > 0
                        ? "text-destructive"
                        : "text-forest-mid"),
                    band === "flat" && "text-muted-foreground",
                  )}
                >
                  {pct == null ? "—" : `${sign}${pct.toFixed(1)}%`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Activity card — same shape used by the order and supplier-invoice
 * detail pages. Wrapped in a thin component so the parent doesn't
 * pull in `useProductActivity` directly and we can change the data
 * shape without touching the page-level layout.
 */
function ProductActivitySection({ productId }: { productId: string }) {
  const { data, isLoading, isError } = useProductActivity(productId);
  return (
    <ActivityCard items={data} isLoading={isLoading} isError={isError} />
  );
}

export function ProductDetailPage({ productId }: { productId: string }) {
  const router = useRouter();
  const {
    data: product,
    isLoading,
    error: loadError,
    isError,
  } = useProduct(productId);

  useSetBreadcrumbLabel(`/products/${productId}`, product?.name);

  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const permanentlyDeleteProduct = usePermanentlyDeleteProduct();
  const [confirmingPermanentDelete, setConfirmingPermanentDelete] =
    useState(false);

  // Mirror the listing's UI gate. Non-admins still get to view product
  // detail, but the Lifecycle section is hidden so they can't click
  // into a Forbidden toast. Server enforces via requireAdminPortalUser.
  const { data: currentUser } = useCurrentPortalUser();
  const canManageLifecycle =
    currentUser?.role === "admin" || currentUser?.role === "owner";

  // Pagination for the Units of measure table. Most products have 2-5
  // units configured so the control hides itself, but it's here for the
  // outlier products that have a dozen+ purchase / sell / case variants.
  const unitsPagination = useClientPagination(product?.productUnits ?? [], 10);

  if (isLoading) return <PageLoading message="Loading product..." />;
  if (isError || !product)
    return (
      <PageError
        message={
          loadError ? (loadError as Error).message : "Product not found."
        }
      />
    );

  const categories = product.productCategories ?? [];
  const units = product.productUnits ?? [];
  const isArchived = !!product.archivedAt;
  const canPermanentlyDelete = product._dependentRecordCount === 0;

  const baseUnitAbbr = getProductBaseUnitAbbreviation(product);

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={product.name}
        description={`Default price/${baseUnitAbbr} is a reference; set customer-specific prices in each customer profile.`}
        badge={
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary" className="font-mono">
              {product.sku}
            </Badge>
            {isArchived ? (
              <Badge
                variant="secondary"
                className="rounded-full px-2 text-[11px] font-medium uppercase tracking-wide"
              >
                Archived
              </Badge>
            ) : null}
          </span>
        }
      >
        {/* Edit is hidden for archived products — they're read-only.
            Restore via the Lifecycle section first, then edit. The
            edit route also enforces this server-side, so a stale
            tab can't bypass it. */}
        {!isArchived ? (
          <Button variant="outline" asChild>
            <Link href={`/products/${product.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </DetailPageHeader>

      {/* Core details */}
      <DetailSection
        title="Details"
        description="Pricing and base unit configuration."
      >
        <DetailGrid>
          <DetailField label="SKU">
            <span className="font-mono text-sm">{product.sku}</span>
          </DetailField>
          <DetailField label={`Default price / ${baseUnitAbbr}`}>
            {(() => {
              const formatted = formatProductDefaultPrice(
                product.defaultPricePerLb,
              );
              return formatted === "—" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <>
                  {formatted}
                  <span className="ml-1 text-xs text-muted-foreground">
                    /{baseUnitAbbr}
                  </span>
                </>
              );
            })()}
          </DetailField>
          <DetailField label="Base unit">
            {product.baseUnit
              ? product.baseUnit.abbreviation
                ? `${product.baseUnit.name} (${product.baseUnit.abbreviation})`
                : product.baseUnit.name
              : <span className="text-muted-foreground">—</span>}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {/* Categories */}
      <DetailSection
        title="Categories"
        description={
          categories.length
            ? `${categories.length} categor${categories.length === 1 ? "y" : "ies"} assigned.`
            : "No categories assigned."
        }
      >
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map(pc => (
              <Badge key={pc.category.id} variant="secondary">
                {pc.category.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}
      </DetailSection>

      {/* Units of measure */}
      <DetailSection
        title="Units of measure"
        description="How this product is stocked, purchased, and sold."
      >
        {units.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Conversion to base</TableHead>
                    <TableHead>Fractional</TableHead>
                    <TableHead>Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitsPagination.rows.map(pu => (
                  <TableRow key={pu.id}>
                    <TableCell>
                      {pu.unit.abbreviation
                        ? `${pu.unit.name} (${pu.unit.abbreviation})`
                        : pu.unit.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {PURPOSE_LABELS[pu.purpose] ?? pu.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {Number(pu.conversionToBase).toString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pu.allowsFractional ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      {pu.isDefault ? (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination state={unitsPagination} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No units configured.</p>
        )}
      </DetailSection>

      {/* New detail-page surfaces — inventory snapshot, recent purchases,
          customer-specific pricing, MVP price intelligence. Each section
          owns its own React Query fetch so the headline renders
          immediately and these stream in. */}
      <ProductInventorySection
        productId={productId}
        baseUnitAbbreviation={baseUnitAbbr}
      />
      <ProductRecentPurchasesSection
        productId={productId}
        baseUnitAbbreviation={baseUnitAbbr}
      />
      <ProductCustomerPricesSection
        productId={productId}
        baseUnitAbbreviation={baseUnitAbbr}
      />
      <ProductPriceIntelligenceSection
        productId={productId}
        productName={product.name}
        baseUnitAbbreviation={baseUnitAbbr}
      />

      {/* Activity — shared timeline card (also used by orders + bills).
          Combines audit_log rows for this product with derived
          baseline events from the audit columns. Replaces a previous
          4-field DetailGrid that didn't match the rest of the app. */}
      <ProductActivitySection productId={productId} />

      {/* Lifecycle — archive (active products), restore (archived
          products), and permanent-delete (only when the product has
          zero dependent rows; the service double-checks and throws a
          human-readable error otherwise).
          Hidden entirely for non-admin / non-owner roles — the server
          actions also reject with Forbidden as defense-in-depth, but
          there's no point dangling buttons that always fail. */}
      {canManageLifecycle ? (
      <DetailSection
        title="Lifecycle"
        description={
          isArchived
            ? "Restore the product to make it selectable again, or remove it permanently."
            : "Archive hides the product from new orders while preserving history. Permanent delete is only available before the product has any business activity."
        }
        className="border-destructive/50"
      >
        <div className="flex flex-wrap gap-2">
          {/* Archive (active only) — primary lifecycle verb. Uses the
              destructive theme because it's a removal-flavoured action;
              Restore (below) is the affirmative counterpart. */}
          {!isArchived ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">
                  Archive product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Hide <strong>{product.name}</strong> from new orders and
                    receiving pickers. Historical lines, prices, and bills
                    stay intact. You can restore it later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={archiveProduct.isPending}
                    onClick={() => {
                      archiveProduct.mutate(productId, {
                        onSuccess: () => {
                          toast.success("Product archived.");
                          router.push("/products");
                        },
                        onError: e =>
                          toast.error(
                            e instanceof Error ? e.message : "Archive failed.",
                          ),
                      });
                    }}
                  >
                    {archiveProduct.isPending ? "Archiving…" : "Archive"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {/* Restore (archived only) */}
          {isArchived ? (
            <Button
              type="button"
              variant="outline"
              disabled={restoreProduct.isPending}
              onClick={() =>
                restoreProduct.mutate(productId, {
                  onSuccess: () => toast.success("Product restored."),
                  onError: e =>
                    toast.error(
                      e instanceof Error ? e.message : "Restore failed.",
                    ),
                })
              }
            >
              {restoreProduct.isPending ? "Restoring…" : "Restore product"}
            </Button>
          ) : null}

          {/* Permanent delete — guarded by _dependentRecordCount.
              Showing the button always (even when disabled) so the
              affordance is discoverable, with the tooltip-via-title
              explaining why it's locked. The service runs the same
              check server-side as a defense-in-depth. */}
          <AlertDialog
            open={confirmingPermanentDelete}
            onOpenChange={open => {
              if (!open) setConfirmingPermanentDelete(false);
            }}
          >
            <Button
              type="button"
              variant="outline"
              disabled={!canPermanentlyDelete || permanentlyDeleteProduct.isPending}
              title={
                canPermanentlyDelete
                  ? undefined
                  : "Has dependent records — archive instead."
              }
              onClick={() => setConfirmingPermanentDelete(true)}
            >
              {permanentlyDeleteProduct.isPending
                ? "Deleting…"
                : "Delete permanently"}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes <strong>{product.name}</strong>{" "}
                  and can’t be undone. Available only because this product
                  has no orders, invoices, prices, or bills referencing
                  it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={permanentlyDeleteProduct.isPending}
                  onClick={() => {
                    permanentlyDeleteProduct.mutate(productId, {
                      onSuccess: () => {
                        toast.success("Product deleted.");
                        router.push("/products");
                      },
                      onError: e =>
                        toast.error(
                          e instanceof Error ? e.message : "Delete failed.",
                        ),
                    });
                    setConfirmingPermanentDelete(false);
                  }}
                >
                  {permanentlyDeleteProduct.isPending
                    ? "Deleting…"
                    : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DetailSection>
      ) : null}
    </div>
  );
}
