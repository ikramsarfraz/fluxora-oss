/**
 * Single source of truth for "what cost did this invoice line record?".
 * Used both server-side at invoice completion (writes to productSupplierCosts)
 * and client-side in the bill form to show a live diff vs the current
 * recorded cost. Same math both places — never re-implement.
 *
 * Weight-priced modes (catch_weight, fixed_case) return a $/lb figure that
 * mirrors what `product_supplier_costs.cost_per_lb` stores. Unit-priced
 * modes (per_each, per_unit) don't have a comparable $/lb figure — they
 * return null, and the caller decides whether to surface a separate cost
 * snapshot or just skip the comparison.
 */

function roundTo(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0";
  const factor = 10 ** decimals;
  return (Math.round(value * factor) / factor).toFixed(decimals);
}

export type SupplierInvoiceLineUnitType =
  | "catch_weight"
  | "fixed_case"
  | "per_each"
  | "per_unit";

export type CostPerLbInput = {
  /** Cases or units depending on `unitType`. Number of weight bearers for catch/fixed. */
  quantityCases: number;
  weightLbs: string;
  unitType: SupplierInvoiceLineUnitType;
  unitPrice: string;
};

/**
 * Returns the per-lb cost as a string, or null when the line doesn't have
 * enough information to compute one (e.g. zero cases or zero weight on a
 * fixed_case line, or a non-weight unit type). Callers should treat null
 * as "no comparable cost yet".
 */
export function supplierInvoiceLineCostPerLb(line: CostPerLbInput): string | null {
  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

  if (line.unitType === "catch_weight") {
    return roundTo(unitPrice, 4);
  }

  if (line.unitType === "fixed_case") {
    const cases = Number(line.quantityCases) || 0;
    const weightLbs = Number(line.weightLbs) || 0;
    if (cases <= 0 || weightLbs <= 0) return null;
    return roundTo((unitPrice * cases) / weightLbs, 4);
  }

  // per_each / per_unit — no per-lb interpretation. The line records cost
  // per unit, which the cost-snapshot writer treats separately.
  return null;
}

export type CostPerUnitInput = {
  unitType: SupplierInvoiceLineUnitType;
  unitPrice: string;
  /** Conversion-to-base snapshot for normalising case-of-12 → each. */
  conversionToBase?: number | null;
};

/**
 * Returns the per-each / per-unit cost as a string for non-weight modes,
 * or null for weight-priced lines. When a conversion factor is provided
 * for per_unit lines, the result is also normalized to per-each (handy
 * for cross-supplier comparison of cases-of-different-pack-sizes).
 */
export function supplierInvoiceLineCostPerUnit(
  line: CostPerUnitInput,
): { perUnit: string; perBase: string | null } | null {
  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

  if (line.unitType !== "per_each" && line.unitType !== "per_unit") {
    return null;
  }

  const perUnit = roundTo(unitPrice, 4);
  const conv = line.conversionToBase ?? null;
  if (line.unitType === "per_each") {
    // Per-each IS the base; the perBase value equals perUnit.
    return { perUnit, perBase: perUnit };
  }
  // per_unit — divide by pack size when we know it. e.g. $9.99/case of 12
  // → $0.8325/each. When pack size is unknown, leave perBase null so the
  // caller doesn't render a misleading number.
  if (conv != null && Number.isFinite(conv) && conv > 0) {
    return { perUnit, perBase: roundTo(unitPrice / conv, 4) };
  }
  return { perUnit, perBase: null };
}
