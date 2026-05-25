// Pure helpers — no server-only / DB imports — safe to call from the
// supplier-bill line editor (client component) AND from tests.

import type { SupplierInvoiceLineUnitType } from "../components/supplier-invoice-form.schema";

// ---------------------------------------------------------------------------
// Product shape — accept anything `ProductListItem`-like. Defined here as a
// permissive interface so this util compiles against both the full
// service-returned shape AND any narrower picker shape callers might use.
// ---------------------------------------------------------------------------

type UnitMeta = {
  id: string;
  abbreviation: string | null;
  name?: string | null;
};

export type ProductWithUnits = {
  baseUnit?: UnitMeta | null;
  productUnits?: Array<{
    purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
    isDefault: boolean;
    sortOrder?: number;
    conversionToBase: string;
    unit?: UnitMeta | null;
    unitId?: string;
  }> | null;
};

export type PurchaseUnitDefault = {
  /** Recommended initial unit type for a freshly-picked product. */
  unitType: SupplierInvoiceLineUnitType;
  /** Abbreviation to render in the UI ("lb", "cs", "ea", "case", "gal"). */
  abbreviation: string;
  /**
   * FK into `units_of_measure` when the default came from an explicit
   * product_units row OR the product's baseUnit. Null when nothing was
   * found (the form still shows a plain abbreviation in that case).
   */
  unitId: string | null;
  /**
   * Conversion factor to base UOM, when the source row carries one.
   * Mostly used for per_unit cost normalisation (e.g. case-of-12 → each).
   */
  conversionToBase: number | null;
};

// ---------------------------------------------------------------------------
// Allow-list of weight abbreviations — used to detect when a UOM should
// trigger catch_weight mode (the default for meat-style products).
// ---------------------------------------------------------------------------

const WEIGHT_ABBREVIATIONS = new Set(["lb", "lbs", "kg", "oz"]);
const EACH_ABBREVIATIONS = new Set(["ea", "each", "pc", "pcs", "piece"]);

/** Lower-cased abbreviation. Tolerates whitespace/casing variants. */
function normalize(abbr: string | null | undefined): string {
  return (abbr ?? "").trim().toLowerCase();
}

/**
 * Map an abbreviation to the supplier-bill line unit type.
 *   lb/kg/oz → catch_weight (sane default for meat; user can flip to fixed_case)
 *   ea/each  → per_each
 *   anything else (cs, gal, bag, pk, …) → per_unit
 */
export function inferLineUnitTypeFromAbbreviation(
  abbreviation: string | null | undefined,
): SupplierInvoiceLineUnitType {
  const norm = normalize(abbreviation);
  if (!norm) return "catch_weight"; // legacy fallback — matches existing default
  if (WEIGHT_ABBREVIATIONS.has(norm)) return "catch_weight";
  if (EACH_ABBREVIATIONS.has(norm)) return "per_each";
  return "per_unit";
}

/**
 * Resolve the default purchase UOM for a product, in priority order:
 *   1. An explicit `product_units` row where `purpose === 'purchase'` and
 *      `isDefault === true` — when present, this is the truth.
 *   2. Any `product_units` row with `purpose === 'purchase'` (lowest sortOrder
 *      wins) — covers products that have purchase rows but no default flag.
 *   3. The product's `baseUnit` — the universal fallback that lets every
 *      product yield SOMETHING sensible even when no purchase rows exist.
 *   4. Null — when the product has no baseUnit either (legacy data). The
 *      caller leaves the line in its current state.
 *
 * Returns the resolved abbreviation + a derived unit type. The unit type
 * is a starting point — the user can still flip catch_weight ↔ fixed_case
 * (since both ride "lb"), or change the abbreviation manually.
 */
export function getDefaultPurchaseUnit(
  product: ProductWithUnits | null | undefined,
): PurchaseUnitDefault | null {
  if (!product) return null;

  const purchaseRows = (product.productUnits ?? []).filter(
    u => u.purpose === "purchase",
  );

  if (purchaseRows.length > 0) {
    // Prefer the explicit default, else the lowest sortOrder, else first row.
    const sorted = [...purchaseRows].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
    const picked = sorted[0];
    const abbreviation = picked.unit?.abbreviation ?? "";
    const conv = Number(picked.conversionToBase);
    return {
      unitType: inferLineUnitTypeFromAbbreviation(abbreviation),
      abbreviation,
      unitId: picked.unit?.id ?? picked.unitId ?? null,
      conversionToBase: Number.isFinite(conv) && conv > 0 ? conv : null,
    };
  }

  // Fallback: derive from baseUnit. Most products in this codebase carry a
  // baseUnit (lb for meat, ea for unit-priced) so this branch handles the
  // common case without forcing a data migration.
  const base = product.baseUnit;
  if (base?.abbreviation) {
    return {
      unitType: inferLineUnitTypeFromAbbreviation(base.abbreviation),
      abbreviation: base.abbreviation,
      unitId: base.id ?? null,
      conversionToBase: 1, // base UOM ≡ itself
    };
  }

  return null;
}
