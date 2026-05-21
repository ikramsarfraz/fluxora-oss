-- Add a `family` classifier to units_of_measure so the catalog can
-- distinguish weight (lb/kg/oz/g) from count (ea/cs/bx/bag/plt/tr/pkt)
-- from volume (gal/L/fl oz). Used by the product form's UOM picker to
-- prevent nonsensical setups like a "lb" product with a "gal" sales
-- unit, and by reports/dashboards to group base-UOM aggregations.
--
-- Default `other` so any unseed value keeps round-tripping safely; the
-- backfill UPDATE classifies the known seed rows.

CREATE TYPE "uom_family" AS ENUM (
  'weight',
  'count',
  'volume',
  'length',
  'other'
);--> statement-breakpoint

ALTER TABLE "units_of_measure"
  ADD COLUMN IF NOT EXISTS "family" "uom_family" NOT NULL DEFAULT 'other';--> statement-breakpoint

-- Backfill known seed rows. Identified by abbreviation; if any row has
-- a non-matching abbreviation it stays 'other' and the operator can
-- correct it manually via the UoM admin screen.
UPDATE "units_of_measure"
SET "family" = CASE
  WHEN LOWER("abbreviation") IN ('lb', 'lbs', 'kg', 'oz', 'g')        THEN 'weight'::"uom_family"
  WHEN LOWER("abbreviation") IN ('ea', 'each', 'pc', 'pcs',
                                  'cs', 'case', 'hcs',
                                  'bx', 'box', 'bag',
                                  'plt', 'pallet', 'tr', 'tray',
                                  'pkt', 'packet', 'pk', 'pack', 'ct') THEN 'count'::"uom_family"
  WHEN LOWER("abbreviation") IN ('gal', 'l', 'fl oz', 'ml')           THEN 'volume'::"uom_family"
  ELSE 'other'::"uom_family"
END
WHERE "family" = 'other';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "units_of_measure_family_idx"
  ON "units_of_measure" ("family");--> statement-breakpoint
