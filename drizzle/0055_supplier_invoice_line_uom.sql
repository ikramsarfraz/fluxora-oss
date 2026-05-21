-- Unit-aware supplier-invoice lines: support per-each and per-unit pricing
-- alongside the existing catch_weight / fixed_case modes. The two new enum
-- values let beverages (cans, cases of 12, gallon jugs, etc.) ride the same
-- bill flow without forcing operators to fabricate a "weight" column.
--
-- Strategy: extend the enum + add optional columns. Existing rows are
-- backfilled with sensible defaults so unchanged code paths keep working.

ALTER TYPE "line_unit_type" ADD VALUE IF NOT EXISTS 'per_each';--> statement-breakpoint
ALTER TYPE "line_unit_type" ADD VALUE IF NOT EXISTS 'per_unit';--> statement-breakpoint

ALTER TABLE "supplier_invoice_lines"
  ADD COLUMN IF NOT EXISTS "purchase_unit_id" uuid REFERENCES "units_of_measure"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "supplier_invoice_lines"
  ADD COLUMN IF NOT EXISTS "quantity" numeric(12,4) NOT NULL DEFAULT 0;--> statement-breakpoint

ALTER TABLE "supplier_invoice_lines"
  ADD COLUMN IF NOT EXISTS "conversion_to_base_snapshot" numeric(12,4);--> statement-breakpoint

ALTER TABLE "supplier_invoice_lines"
  ADD COLUMN IF NOT EXISTS "purchase_unit_abbreviation_snapshot" varchar(16);--> statement-breakpoint

-- pricing_unit_type_snapshot is nullable so old rows can stay null and
-- new rows record the explicit per_lb / per_case / per_each / per_unit
-- shape. We reuse the existing enum for per_lb/per_case but represent
-- the new types via the line_unit_type column.
ALTER TABLE "supplier_invoice_lines"
  ADD COLUMN IF NOT EXISTS "pricing_unit_type_snapshot" "pricing_unit_type";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "supplier_invoice_lines_purchase_unit_id_idx"
  ON "supplier_invoice_lines" ("purchase_unit_id");--> statement-breakpoint

-- Backfill: existing rows now carry a sensible pricing_unit_type_snapshot
-- and a quantity that mirrors quantity_cases. weight_lbs stays untouched
-- because catch_weight math still reads it.
UPDATE "supplier_invoice_lines"
SET
  "quantity" = COALESCE(NULLIF("quantity", 0), "quantity_cases"),
  "pricing_unit_type_snapshot" = CASE
    WHEN "unit_type" = 'catch_weight' THEN 'per_lb'::"pricing_unit_type"
    WHEN "unit_type" = 'fixed_case' THEN 'per_case'::"pricing_unit_type"
    ELSE "pricing_unit_type_snapshot"
  END,
  "purchase_unit_abbreviation_snapshot" = COALESCE(
    "purchase_unit_abbreviation_snapshot",
    CASE
      WHEN "unit_type" = 'catch_weight' THEN 'lb'
      WHEN "unit_type" = 'fixed_case' THEN 'cs'
      ELSE NULL
    END
  )
WHERE "quantity" = 0 OR "pricing_unit_type_snapshot" IS NULL;--> statement-breakpoint
