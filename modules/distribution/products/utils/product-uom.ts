/**
 * Display helpers for product UOMs. Used by the catalog, order surfaces,
 * invoice PDF, customer pricing, and supplier comparison so every "/lb"
 * suffix renders from the product's actual base UOM rather than a
 * hardcoded literal.
 *
 * No server-only imports — safe to use from client components and tests.
 */

import { formatMoney } from "@/lib/utils/currency";

type WithBaseUnit = {
  baseUnit?: { abbreviation?: string | null; name?: string | null } | null;
};

const FALLBACK_ABBREVIATION = "unit";

/**
 * Render the abbreviation for a product's base UOM. Falls back to "unit"
 * for rows whose base UOM relation was unexpectedly null — historical
 * data shouldn't trigger this, but a tenant in a non-meat vertical
 * shouldn't see "lb" rendered for a missing base unit.
 */
export function getProductBaseUnitAbbreviation(
  product: WithBaseUnit | null | undefined,
): string {
  return product?.baseUnit?.abbreviation ?? FALLBACK_ABBREVIATION;
}

/**
 * Render the full unit name for places that have room for it (form
 * labels, helper text). Falls back to the abbreviation, then to "unit".
 */
export function getProductBaseUnitName(
  product: WithBaseUnit | null | undefined,
): string {
  return (
    product?.baseUnit?.name ??
    product?.baseUnit?.abbreviation ??
    FALLBACK_ABBREVIATION
  );
}

/**
 * Render the catalog default price, treating `null`, empty string, and
 * a stored "0" as "no default set" — the `products.default_price_per_lb`
 * column is `NOT NULL` and the form coerces empty input to "0", so
 * zero is the canonical sentinel for "user didn't fill this in" rather
 * than an actual price of zero. Returns the placeholder (default "—")
 * in that case so listing and detail surfaces stay consistent.
 */
export function formatProductDefaultPrice(
  value: string | number | null | undefined,
  options?: { placeholder?: string },
): string {
  const placeholder = options?.placeholder ?? "—";
  if (value == null || value === "") return placeholder;
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n) || n === 0) return placeholder;
  return formatMoney(value);
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
