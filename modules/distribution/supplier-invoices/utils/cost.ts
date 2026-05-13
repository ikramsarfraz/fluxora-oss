/**
 * Single source of truth for "what cost per lb did this invoice line record?".
 * Used both server-side at invoice completion (writes to productSupplierCosts)
 * and client-side in the bill form to show a live diff vs the current
 * recorded cost. Same math both places — never re-implement.
 */

function roundTo(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0";
  const factor = 10 ** decimals;
  return (Math.round(value * factor) / factor).toFixed(decimals);
}

export type CostPerLbInput = {
  quantityCases: number;
  weightLbs: string;
  unitType: "catch_weight" | "fixed_case";
  unitPrice: string;
};

/**
 * Returns the per-lb cost as a string, or null when the line doesn't have
 * enough information to compute one (e.g. zero cases or zero weight on a
 * fixed_case line). Callers should treat null as "no comparable cost yet".
 */
export function supplierInvoiceLineCostPerLb(line: CostPerLbInput): string | null {
  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

  if (line.unitType === "catch_weight") {
    return roundTo(unitPrice, 4);
  }

  const cases = Number(line.quantityCases) || 0;
  const weightLbs = Number(line.weightLbs) || 0;
  if (cases <= 0 || weightLbs <= 0) return null;

  return roundTo((unitPrice * cases) / weightLbs, 4);
}
