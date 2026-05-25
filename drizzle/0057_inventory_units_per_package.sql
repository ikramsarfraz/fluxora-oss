-- Snapshot the pack-size on each inventory_items row so the on-hand
-- math knows how many base units (eaches) a single case represents.
-- Previously inventory_items rows for per_each / per_unit bills were
-- 1-per-case with no record of "this case contains 24 cans", which
-- made the rollup display "55 cases / 55 ea" for 55 cases of a
-- 24-pack — wrong by a factor of 24.
--
-- Backfill copies the conversion factor from the source supplier
-- invoice line (added in migration 0055). Items without a linked
-- supplier-invoice-line keep null = "1 base unit per row" (the
-- historical assumption for catch-weight meat).

ALTER TABLE "inventory_items"
  ADD COLUMN IF NOT EXISTS "units_per_package_snapshot" numeric(12, 4);--> statement-breakpoint

UPDATE "inventory_items" ii
SET "units_per_package_snapshot" = sil."conversion_to_base_snapshot"
FROM "lot_receipts" lr
INNER JOIN "supplier_invoice_lines" sil ON sil."id" = lr."supplier_invoice_line_id"
WHERE ii."lot_id" = lr."lot_id"
  AND ii."units_per_package_snapshot" IS NULL
  AND sil."conversion_to_base_snapshot" IS NOT NULL;--> statement-breakpoint
