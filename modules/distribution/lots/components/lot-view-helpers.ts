import type { LotDetail, LotListItem } from "../services/lots";

type LotLike = LotListItem | LotDetail;
type InvoiceLike = NonNullable<
  LotLike["lotReceipts"][number]["supplierInvoiceLine"]
>["supplierInvoice"];

function isInvoiceLike(value: InvoiceLike | null | undefined): value is InvoiceLike {
  return Boolean(value);
}

export function getLotPrimaryProduct(lot: LotLike) {
  return (
    lot.lotReceipts[0]?.supplierInvoiceLine?.product ??
    lot.inventoryItems[0]?.product ??
    null
  );
}

export function getLotSourceInvoices(lot: LotLike) {
  return Array.from(
    new Map(
      lot.lotReceipts
        .map(receipt => receipt.supplierInvoiceLine?.supplierInvoice)
        .filter(isInvoiceLike)
        .map(invoice => [invoice.id, invoice]),
    ).values(),
  );
}

export function getLotTotals(lot: LotLike) {
  // Split aggregates by family: weight items contribute to totalWeight,
  // count items contribute to totalUnits as `cases × pack-size` so a
  // lot holding 5 cases of a 24-pack reports 120 units, not 5. Pack
  // size defaults to 1 for legacy rows (one inventory_items row IS one
  // base unit) so weight + per_each lots produce the same numbers as
  // before this snapshot column was added.
  let totalWeight = 0;
  let totalUnits = 0;
  let totalCases = 0;
  for (const item of lot.inventoryItems) {
    const isWeightMode =
      item.costUnitTypeSnapshot === "catch_weight" ||
      item.costUnitTypeSnapshot === "fixed_case" ||
      item.costUnitTypeSnapshot == null; // legacy default → assume weight
    if (isWeightMode) {
      totalWeight += Number(item.exactWeightLbs) || 0;
    } else {
      const cases = Number(item.cases) || 0;
      const pack = Number(item.unitsPerPackageSnapshot ?? 1) || 1;
      totalCases += cases;
      totalUnits += cases * pack;
    }
  }
  return {
    inventoryItemCount: lot.inventoryItems.length,
    totalWeight,
    totalUnits,
    /**
     * Physical case count separate from totalUnits so the lot detail
     * can render both "120 ea" and "(5 cs)" when the pack multiplies
     * a single case into multiple sellable base units.
     */
    totalCases,
    statuses: lot.inventoryItems.map(item => item.status),
  };
}

/**
 * Returns true when the lot's primary product is non-weight (beverages,
 * cans, etc.). Used by the lots list / lot detail to pick whether the
 * row's quantity column reads "X lb" or "N {baseUnit}".
 */
export function isLotNonWeight(lot: LotLike): boolean {
  const product = getLotPrimaryProduct(lot);
  const family = product?.baseUnit?.family;
  if (family) return family !== "weight";
  // Fall back to inventory_items.cost_unit_type_snapshot when no
  // baseUnit is loaded — handles legacy queries that don't eager-load.
  return lot.inventoryItems.some(
    item =>
      item.costUnitTypeSnapshot === "per_each" ||
      item.costUnitTypeSnapshot === "per_unit",
  );
}
