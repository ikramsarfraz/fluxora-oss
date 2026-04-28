export function normalizeSpeciesForSku(species: string): string {
  const s = (species ?? "").toLowerCase();
  if (s.startsWith("chicken")) return "CHK";
  if (s.startsWith("beef")) return "BEF";
  if (s.startsWith("pork")) return "PRK";
  if (s.startsWith("lamb")) return "LAM";
  if (s.startsWith("seafood") || s.startsWith("fish")) return "SEA";
  return "OTH";
}

export function slugFromName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "ITEM";
  const parts = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "ITEM";
  const word = parts[0];
  return word.slice(0, 4);
}

/** Generate a compact SKU like CHK-RIBE-01 based on category + name + existing products. */
export function generateSku(
  name: string,
  species: string,
  products: readonly { sku: string }[] | undefined,
): string {
  const prefix = normalizeSpeciesForSku(species);
  const nameSlug = slugFromName(name);
  const base = `${prefix}-${nameSlug}`;
  const existing = (products ?? [])
    .map(p => p.sku)
    .filter(
      sku =>
        typeof sku === "string" &&
        sku.toUpperCase().startsWith(base.toUpperCase()),
    );

  let maxSuffix = 0;
  for (const sku of existing) {
    const m = sku.match(/-(\d{2,})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxSuffix) maxSuffix = n;
    }
  }
  const next = (maxSuffix + 1).toString().padStart(2, "0");
  return `${base}-${next}`;
}
