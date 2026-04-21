/**
 * Seed global units of measure.
 * Safe to run multiple times — uses onConflictDoNothing on the unique `name` column.
 *
 * Usage:
 *   npx tsx db/seed-uom.ts
 */

import { db } from "./index";
import { unitsOfMeasure } from "./schema";

const UOM_DATA: {
  name: string;
  abbreviation: string | null;
  notes: string | null;
  sortOrder: number;
}[] = [
  // ── Weight ──────────────────────────────────────────────────────────────
  { name: "Pound",      abbreviation: "lb",  notes: null,                     sortOrder: 10 },
  { name: "Kilogram",   abbreviation: "kg",  notes: "1 kg = 2.2046 lb",       sortOrder: 11 },
  { name: "Ounce",      abbreviation: "oz",  notes: "16 oz = 1 lb",           sortOrder: 12 },
  { name: "Gram",       abbreviation: "g",   notes: "1000 g = 1 kg",          sortOrder: 13 },

  // ── Count / Packaging ────────────────────────────────────────────────────
  { name: "Each",       abbreviation: "ea",  notes: "Single unit / piece",    sortOrder: 20 },
  { name: "Case",       abbreviation: "cs",  notes: null,                     sortOrder: 21 },
  { name: "Half Case",  abbreviation: "hcs", notes: null,                     sortOrder: 22 },
  { name: "Box",        abbreviation: "bx",  notes: null,                     sortOrder: 23 },
  { name: "Bag",        abbreviation: "bag", notes: null,                     sortOrder: 24 },
  { name: "Pallet",     abbreviation: "plt", notes: null,                     sortOrder: 25 },
  { name: "Tray",       abbreviation: "tr",  notes: null,                     sortOrder: 26 },
  { name: "Packet",     abbreviation: "pkt", notes: null,                     sortOrder: 27 },

  // ── Volume ───────────────────────────────────────────────────────────────
  { name: "Gallon",     abbreviation: "gal", notes: null,                     sortOrder: 30 },
  { name: "Liter",      abbreviation: "L",   notes: null,                     sortOrder: 31 },
  { name: "Fluid Ounce",abbreviation: "fl oz",notes: "128 fl oz = 1 gal",    sortOrder: 32 },
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
