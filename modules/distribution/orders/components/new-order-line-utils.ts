import type { ProductListItem } from "@/modules/distribution/products/services/products";

import type { LineUnitType, NewOrderLineValues } from "./new-order-form.schema";

export type ProductSalesUnit = NonNullable<ProductListItem["productUnits"]>[number];

const WEIGHT_UNIT_NAMES = new Set(["lb", "lbs", "pound", "pounds"]);

function normalizeUnitToken(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function isWeightUnitLabel(value?: string | null): boolean {
  return WEIGHT_UNIT_NAMES.has(normalizeUnitToken(value));
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

export function inferLineUnitType(
  product?: ProductListItem | null,
): LineUnitType {
  if (!product?.baseUnit) return "fixed_case";
  const baseUnit = product.baseUnit;
  return isWeightUnitLabel(baseUnit.abbreviation) ||
      isWeightUnitLabel(baseUnit.name)
    ? "catch_weight"
    : "fixed_case";
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

export function calculateLineTotal(
  line: Pick<
    NewOrderLineValues,
    "quantity" | "pricePerLb" | "unitType" | "salesUnitId"
  >,
  product?: ProductListItem | null,
): number | null {
  const quantity = Number(line.quantity ?? "");
  const price = Number(line.pricePerLb ?? "");

  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price < 0) return null;

  // Price is always per atomic unit ($/lb or $/ea).
  // Multiply by conversionToBase to get the total for any selling unit.
  // For lb or ea units, conversionToBase = 1 so the formula is the same.
  // For case units, conversionToBase = lbs/case or units/case.
  const salesUnit = getSelectedSalesUnit(product, line.salesUnitId);
  const conversion = Number(salesUnit?.conversionToBase ?? "1");
  if (!Number.isFinite(conversion) || conversion <= 0) return null;
  return quantity * conversion * price;
}
