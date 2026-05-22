import type { ProductListItem } from "@/modules/distribution/products/services/products";

import type { LineUnitType, NewOrderLineValues } from "./new-order-form.schema";

export type ProductSalesUnit = NonNullable<ProductListItem["productUnits"]>[number];

// Expanded to cover kg / oz / g so non-US weight catalogs aren't
// silently treated as count items.
const WEIGHT_UNIT_NAMES = new Set([
  "lb",
  "lbs",
  "pound",
  "pounds",
  "kg",
  "kilogram",
  "kilograms",
  "oz",
  "ounce",
  "ounces",
  "g",
  "gram",
  "grams",
]);

function normalizeUnitToken(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function isWeightUnitLabel(value?: string | null): boolean {
  return WEIGHT_UNIT_NAMES.has(normalizeUnitToken(value));
}

/**
 * Returns true when the UoM (or product baseUnit) belongs to the weight
 * family. Prefers the explicit `family` field from `units_of_measure`
 * (added in migration 0056); falls back to abbreviation/name matching
 * for older code paths that haven't loaded the field.
 */
function isWeightFamilyUom(unit: {
  abbreviation?: string | null;
  name?: string | null;
  family?: string | null;
}): boolean {
  if (unit.family === "weight") return true;
  if (unit.family && unit.family !== "weight") return false;
  return isWeightUnitLabel(unit.abbreviation) || isWeightUnitLabel(unit.name);
}

export function isWeightSalesUnit(unit?: ProductSalesUnit | null): boolean {
  if (!unit) return false;
  return isWeightFamilyUom(unit.unit);
}

function sortSalesUnits(a: ProductSalesUnit, b: ProductSalesUnit): number {
  if (a.isDefault !== b.isDefault) {
    return a.isDefault ? -1 : 1;
  }
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return (a.unit.abbreviation ?? a.unit.name).localeCompare(
    b.unit.abbreviation ?? b.unit.name,
  );
}

export function getSalesUnits(
  product?: ProductListItem | null,
): ProductSalesUnit[] {
  return [...(product?.productUnits ?? [])]
    .filter(unit => unit.purpose === "sales")
    .sort(sortSalesUnits);
}

export function getDefaultSalesUnit(
  product?: ProductListItem | null,
): ProductSalesUnit | null {
  const salesUnits = getSalesUnits(product);
  return salesUnits[0] ?? null;
}

export function getSelectedSalesUnit(
  product: ProductListItem | null | undefined,
  salesUnitId: string | undefined,
): ProductSalesUnit | null {
  if (!product || !salesUnitId) return null;
  return getSalesUnits(product).find(unit => unit.unitId === salesUnitId) ?? null;
}

export function formatSalesUnitLabel(unit?: ProductSalesUnit | null): string {
  if (!unit) return "—";
  return unit.unit.abbreviation
    ? `${unit.unit.name} (${unit.unit.abbreviation})`
    : unit.unit.name;
}

export function formatSalesUnitShortLabel(
  unit?: ProductSalesUnit | null,
): string {
  if (!unit) return "unit";
  return unit.unit.abbreviation || unit.unit.name;
}

/**
 * Suggest the line's unit type from the product's base UOM family.
 * Returns the narrower binary the sales-order form currently accepts
 * (`catch_weight | fixed_case`) — weight bases get catch_weight, every
 * other family lands on fixed_case so the case-priced math kicks in.
 *
 * The schema now supports `per_each` / `per_unit` too, but the order
 * form's snapshot maps non-weight modes onto `per_case` in
 * `pricingUnitTypeSnapshot` either way, so keeping the form-level type
 * as fixed_case is functionally equivalent and avoids forking the UI.
 */
export function inferLineUnitType(
  product?: ProductListItem | null,
): LineUnitType {
  if (!product?.baseUnit) return "fixed_case";
  return isWeightFamilyUom(product.baseUnit) ? "catch_weight" : "fixed_case";
}

export function getUnitTypeDisplayLabel(
  unitType: LineUnitType | undefined,
): string {
  return unitType === "catch_weight" ? "Catch weight" : "Fixed quantity";
}

export function getLinePriceLabel(
  unitType: LineUnitType | undefined,
  salesUnit: ProductSalesUnit | null,
): string {
  if (unitType === "catch_weight") return "$ / lb";
  return `$ / ${formatSalesUnitShortLabel(salesUnit)}`;
}

export function calculateLineTotalFromWeight(
  totalWeightLbs: number,
  pricePerLb: string | undefined,
): number | null {
  const price = Number(pricePerLb ?? "");
  if (!Number.isFinite(price) || price < 0) return null;
  if (totalWeightLbs <= 0) return null;
  return totalWeightLbs * price;
}

export function calculateLineTotal(
  line: Pick<
    NewOrderLineValues,
    "quantity" | "pricePerLb" | "unitType" | "salesUnitId"
  >,
  product?: ProductListItem | null,
  /**
   * Real fulfilled/allocated weight in lbs for the line, when known.
   * Catch-weight lines bill on the real lot weight, not the product's
   * stated avg-case-weight estimate. Passing this lets the subtotal
   * agree with the line-row total when the two differ (e.g. allocation
   * covers fewer real cases than the product config assumes).
   */
  effectiveWeightLbs?: number | null,
): number | null {
  const price = Number(line.pricePerLb ?? "");
  if (!Number.isFinite(price) || price < 0) return null;

  // Catch-weight with a known real weight: bill on that weight, period.
  // This is the source of truth for the line row; the summary should
  // match.
  if (
    line.unitType === "catch_weight" &&
    effectiveWeightLbs != null &&
    Number.isFinite(effectiveWeightLbs) &&
    effectiveWeightLbs > 0
  ) {
    return effectiveWeightLbs * price;
  }

  const quantity = Number(line.quantity ?? "");
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  // Price is always per atomic unit ($/lb or $/ea).
  // Multiply by conversionToBase to get the total for any selling unit.
  // For lb or ea units, conversionToBase = 1 so the formula is the same.
  // For case units, conversionToBase = lbs/case or units/case.
  const salesUnit = getSelectedSalesUnit(product, line.salesUnitId);
  // If the sales unit IS a weight unit (lb/lbs/pound), the qty is
  // already in lbs and the base unit is also lb — so conversion must
  // be 1 regardless of what's stored on the unit row. Some test
  // products carry a misconfigured `conversionToBase` (e.g. 0.04) on
  // the `lb` unit, which would otherwise yield nonsense totals like
  // 20 lbs × $10/lb = $8. The line-row weight calc has the same
  // clamp via `Math.max(1, avgLbsPerCase || 1)`; this mirrors it.
  const conversion = isWeightSalesUnit(salesUnit)
    ? 1
    : Number(salesUnit?.conversionToBase ?? "1");
  if (!Number.isFinite(conversion) || conversion <= 0) return null;
  return quantity * conversion * price;
}
