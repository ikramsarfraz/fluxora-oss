ALTER TABLE "inventory_items"
  ADD COLUMN "cost_per_unit_snapshot" numeric(12, 6),
  ADD COLUMN "cost_unit_type_snapshot" "line_unit_type";

UPDATE "inventory_items"
SET
  "cost_per_unit_snapshot" = 0,
  "cost_unit_type_snapshot" = 'catch_weight'
WHERE "cost_per_unit_snapshot" IS NULL
   OR "cost_unit_type_snapshot" IS NULL;

UPDATE "inventory_items" AS ii
SET
  "cost_per_unit_snapshot" = snapshot."unit_price",
  "cost_unit_type_snapshot" = snapshot."unit_type"
FROM (
  SELECT DISTINCT ON (lr."lot_id")
    lr."lot_id",
    sil."unit_price",
    sil."unit_type"
  FROM "lot_receipts" lr
  INNER JOIN "supplier_invoice_lines" sil
    ON sil."id" = lr."supplier_invoice_line_id"
  ORDER BY lr."lot_id", sil."created_at" DESC
) AS snapshot
WHERE ii."lot_id" = snapshot."lot_id";

UPDATE "inventory_items"
SET
  "cost_per_unit_snapshot" = COALESCE("cost_per_unit_snapshot", 0),
  "cost_unit_type_snapshot" = COALESCE("cost_unit_type_snapshot", 'catch_weight');

ALTER TABLE "inventory_items"
  ALTER COLUMN "cost_per_unit_snapshot" SET DEFAULT 0,
  ALTER COLUMN "cost_per_unit_snapshot" SET NOT NULL,
  ALTER COLUMN "cost_unit_type_snapshot" SET DEFAULT 'catch_weight',
  ALTER COLUMN "cost_unit_type_snapshot" SET NOT NULL;
