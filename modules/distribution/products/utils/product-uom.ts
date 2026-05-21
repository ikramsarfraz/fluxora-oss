/**
 * Display helpers for product UOMs. Used by the catalog, order surfaces,
 * invoice PDF, customer pricing, and supplier comparison so every "/lb"
 * suffix renders from the product's actual base UOM rather than a
 * hardcoded literal.
 *
 * No server-only imports — safe to use from client components and tests.
 */

type WithBaseUnit = {
  baseUnit?: { abbreviation?: string | null; name?: string | null } | null;
};

/**
 * Render the abbreviation for a product's base UOM. Falls back to "lb"
 * for historical data that never carried a base unit — every catalog
 * row in production today has one, this is just defensive.
 */
export function getProductBaseUnitAbbreviation(
  product: WithBaseUnit | null | undefined,
): string {
  return product?.baseUnit?.abbreviation ?? "lb";
}

/**
 * Render the full unit name for places that have room for it (form
 * labels, helper text). Falls back to the abbreviation, then to "lb".
 */
export function getProductBaseUnitName(
  product: WithBaseUnit | null | undefined,
): string {
  return (
    product?.baseUnit?.name ?? product?.baseUnit?.abbreviation ?? "lb"
  );
}

/**
 * Build a "/{abbr}" suffix string for inline price labels (e.g. "/lb").
 * Centralized so future label changes (e.g. " per lb" vs "/lb") happen
 * in one place.
 */
export function formatPerUnitSuffix(
  product: WithBaseUnit | null | undefined,
): string {
  return `/${getProductBaseUnitAbbreviation(product)}`;
}

/**
 * For surfaces that snapshot a sales/purchase unit at moment of write
 * (sales-order lines, supplier-bill payments). Prefers the snapshot,
 * then the product's base, then "lb". Pass either the abbreviation
 * string directly or the snapshot field name.
 */
export function getSnapshotAbbreviation(
  snapshotAbbreviation: string | null | undefined,
  product: WithBaseUnit | null | undefined,
): string {
  const trimmed = snapshotAbbreviation?.trim();
  if (trimmed) return trimmed;
  return getProductBaseUnitAbbreviation(product);
}
