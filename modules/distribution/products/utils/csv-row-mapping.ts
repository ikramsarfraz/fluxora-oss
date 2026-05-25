import type { BulkCreateProductInput } from "../services/products";

/**
 * Maps one row of a parsed products CSV into the service's bulk-create
 * input shape. Pure function — no DB, no React state, no I/O — so the
 * CSV-import page and tests can both use it. Category and unit lookups
 * (string → uuid) happen in the page layer where the React Query caches
 * for categories + units are available.
 *
 * Rules:
 *   - `sku` and `name` are trimmed; the service treats them as required.
 *   - `default_price` is trimmed; empty falls through to the service's
 *     `"0"` default. Non-numeric strings are passed through so the
 *     service surfaces them as per-row errors (rather than silently
 *     coercing to zero, which would lie to the user).
 *   - `categoryId` / `baseUnitId` are RESOLVED ids supplied by the
 *     caller — the CSV has `category` and `unit` as human-readable
 *     names/abbreviations, and the caller maps those to uuids before
 *     calling. Unresolved values pass through as `null` so the row
 *     still imports (a product without a category is half-broken but
 *     recoverable via the edit form; a hard error here would lose the
 *     whole row).
 */
export function csvRowToProductInput(
  row: Record<string, string>,
  resolved: { categoryId?: string | null; baseUnitId?: string | null } = {},
): BulkCreateProductInput {
  return {
    sku: row.sku?.trim() ?? "",
    name: row.name?.trim() ?? "",
    categoryId: resolved.categoryId ?? null,
    baseUnitId: resolved.baseUnitId ?? null,
    defaultPricePerLb: row.default_price?.trim() || undefined,
  };
}

/**
 * Helpers for the page-layer string→uuid lookups. Kept here so any
 * future caller (a server import job, a CLI tool) can use the same
 * matching rules.
 */

/**
 * Match a category by exact-case-insensitive name. The current category
 * model doesn't support a richer match — slug/abbreviation could come
 * later, but the unique index is on `(tenant_id, name)`.
 */
export function findCategoryIdByName(
  raw: string | undefined,
  categories: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  const hit = categories.find(c => c.name.toLowerCase() === trimmed);
  return hit?.id ?? null;
}

/**
 * Match a unit of measure by abbreviation (case-insensitive). Falls
 * back to matching by name so a CSV that says "Pound" instead of "lb"
 * still resolves.
 */
export function findUnitIdByAbbreviation(
  raw: string | undefined,
  units: ReadonlyArray<{
    id: string;
    abbreviation: string | null;
    name: string;
    isActive: boolean;
  }>,
): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  const active = units.filter(u => u.isActive);
  const byAbbr = active.find(
    u => u.abbreviation?.toLowerCase() === trimmed,
  );
  if (byAbbr) return byAbbr.id;
  const byName = active.find(u => u.name.toLowerCase() === trimmed);
  return byName?.id ?? null;
}
