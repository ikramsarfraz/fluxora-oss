/**
 * Seed global units of measure.
 * Safe to run multiple times — uses onConflictDoNothing on the unique `name` column.
 *
 * Usage:
 *   npx tsx db/seed-uom.ts
 *
 * The `family` column was added in migration 0056. Each row below carries
 * the family so the product form can group + filter the UOM picker and
 * reports can group aggregates correctly. New rows added by hand via the
 * UoM admin should be classified; rows left as 'other' won't break, but
 * they can't participate in family-match validation.
 */

import { db } from "./index";
import { unitsOfMeasure } from "./schema";

type UomFamily = "weight" | "count" | "volume" | "length" | "other";

const UOM_DATA: {
  name: string;
  abbreviation: string | null;
  notes: string | null;
  family: UomFamily;
  sortOrder: number;
}[] = [
  // ── Weight ──────────────────────────────────────────────────────────────
  { name: "Pound",      abbreviation: "lb",  notes: null,                     family: "weight", sortOrder: 10 },
  { name: "Kilogram",   abbreviation: "kg",  notes: "1 kg = 2.2046 lb",       family: "weight", sortOrder: 11 },
  { name: "Ounce",      abbreviation: "oz",  notes: "16 oz = 1 lb",           family: "weight", sortOrder: 12 },
  { name: "Gram",       abbreviation: "g",   notes: "1000 g = 1 kg",          family: "weight", sortOrder: 13 },

  // ── Count / Packaging ────────────────────────────────────────────────────
  { name: "Each",       abbreviation: "ea",  notes: "Single unit / piece",    family: "count",  sortOrder: 20 },
  { name: "Case",       abbreviation: "cs",  notes: null,                     family: "count",  sortOrder: 21 },
  { name: "Half Case",  abbreviation: "hcs", notes: null,                     family: "count",  sortOrder: 22 },
  { name: "Box",        abbreviation: "bx",  notes: null,                     family: "count",  sortOrder: 23 },
  { name: "Bag",        abbreviation: "bag", notes: null,                     family: "count",  sortOrder: 24 },
  { name: "Pack",       abbreviation: "pk",  notes: "Multipack / sleeve",     family: "count",  sortOrder: 25 },
  { name: "Pallet",     abbreviation: "plt", notes: null,                     family: "count",  sortOrder: 26 },
  { name: "Tray",       abbreviation: "tr",  notes: null,                     family: "count",  sortOrder: 27 },
  { name: "Packet",     abbreviation: "pkt", notes: null,                     family: "count",  sortOrder: 28 },
  { name: "Count",      abbreviation: "ct",  notes: "Generic count unit",     family: "count",  sortOrder: 29 },

  // ── Volume ───────────────────────────────────────────────────────────────
  { name: "Gallon",     abbreviation: "gal", notes: null,                     family: "volume", sortOrder: 30 },
  { name: "Liter",      abbreviation: "L",   notes: null,                     family: "volume", sortOrder: 31 },
  { name: "Fluid Ounce",abbreviation: "fl oz",notes: "128 fl oz = 1 gal",    family: "volume", sortOrder: 32 },
  { name: "Milliliter", abbreviation: "ml",  notes: "1000 ml = 1 L",          family: "volume", sortOrder: 33 },
];

async function seedUom() {
  console.log("Seeding units of measure…");

  for (const row of UOM_DATA) {
    await db
      .insert(unitsOfMeasure)
      .values({ ...row, isActive: true })
      .onConflictDoNothing();
  }

  console.log(`Done — ${UOM_DATA.length} rows (skipped any duplicates).`);
}

seedUom()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed UOM failed:", err);
    process.exit(1);
  });
