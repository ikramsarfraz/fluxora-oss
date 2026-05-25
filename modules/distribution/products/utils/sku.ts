/**
 * Pure SKU-generation helpers. No server or React imports — safe to call
 * from both the form (preview hooks) and the service (persistence layer).
 *
 * SKU shape: `<PREFIX>-<NAMEWORD>-<NN>` (e.g. `BEF-RIBE-01`). The prefix
 * is derived from the first category name when one matches a known
 * vertical (beef, chicken, pork, lamb, seafood/fish); otherwise it
 * falls back to `OTH` so tenants in non-meat verticals still get a
 * stable, readable prefix.
 */

const KNOWN_PREFIXES: ReadonlyArray<[RegExp, string]> = [
  [/^chicken/, "CHK"],
  [/^beef/, "BEF"],
  [/^pork/, "PRK"],
  [/^lamb/, "LAM"],
  [/^(seafood|fish)/, "SEA"],
];

/**
 * Map a category name to a 3-letter SKU prefix. Falls back to `OTH` for
 * any name that doesn't match a known vertical. (Historical name —
 * "species" — kept for the function but the input is a category name.)
 */
export function categoryNameToSkuPrefix(category: string | null | undefined): string {
  const s = (category ?? "").toLowerCase();
  for (const [pattern, prefix] of KNOWN_PREFIXES) {
    if (pattern.test(s)) return prefix;
  }
  return "OTH";
}

/** Take the first word of the product name and slug it to ≤4 uppercase chars. */
export function slugFromName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "ITEM";
  const parts = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "ITEM";
  return parts[0].slice(0, 4);
}

/** The `<PREFIX>-<NAMEWORD>` portion of a SKU, without the numeric suffix. */
export function buildSkuBase(
  name: string,
  categoryName: string | null | undefined,
): string {
  return `${categoryNameToSkuPrefix(categoryName)}-${slugFromName(name)}`;
}

/**
 * Pick the next `-NN` suffix for `base` given a list of existing SKUs.
 * Returns `<base>-NN`. The list can be drawn from a client-side cache
 * (preview) or from a DB query (persistence). Either way the algorithm
 * is identical, so a stale preview and a fresh server pick agree
 * whenever the catalog hasn't changed between read and write.
 */
export function nextSkuForBase(
  base: string,
  existingSkus: readonly string[],
): string {
  const baseUpper = base.toUpperCase();
  let maxSuffix = 0;
  for (const sku of existingSkus) {
    if (typeof sku !== "string") continue;
    if (!sku.toUpperCase().startsWith(baseUpper)) continue;
    const m = sku.match(/-(\d{2,})$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > maxSuffix) maxSuffix = n;
  }
  const next = (maxSuffix + 1).toString().padStart(2, "0");
  return `${base}-${next}`;
}

/** Convenience: combine `buildSkuBase` + `nextSkuForBase` in one call. */
export function generateSku(
  name: string,
  categoryName: string | null | undefined,
  existingProducts: readonly { sku: string }[] | undefined,
): string {
  const base = buildSkuBase(name, categoryName);
  return nextSkuForBase(
    base,
    (existingProducts ?? []).map(p => p.sku),
  );
}
