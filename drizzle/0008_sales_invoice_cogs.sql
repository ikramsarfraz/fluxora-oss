ALTER TABLE "sales_order_fulfillments"
  ADD COLUMN "cost_per_unit_snapshot" numeric(12, 6),
  ADD COLUMN "cost_unit_type_snapshot" "line_unit_type",
  ADD COLUMN "cost_amount_snapshot" numeric(12, 4) DEFAULT 0 NOT NULL;

UPDATE "sales_order_fulfillments" AS sof
SET
  "cost_per_unit_snapshot" = ii."cost_per_unit_snapshot",
  "cost_unit_type_snapshot" = ii."cost_unit_type_snapshot",
  "cost_amount_snapshot" = CASE
    WHEN ii."cost_unit_type_snapshot" = 'fixed_case'
      THEN COALESCE(sof."quantity_fulfilled", 0)::numeric * COALESCE(ii."cost_per_unit_snapshot", 0)::numeric
    ELSE COALESCE(sof."weight_lbs", 0)::numeric * COALESCE(ii."cost_per_unit_snapshot", 0)::numeric
  END
FROM "inventory_items" ii
WHERE sof."inventory_item_id" = ii."id";

ALTER TABLE "sales_invoice_lines"
  ADD COLUMN "cogs_amount_snapshot" numeric(12, 4) DEFAULT 0 NOT NULL;
