-- Add isPrimary and lastReceivedAt columns to product_supplier_costs.
-- For existing rows: if a product has exactly one supplier cost, mark it primary.
-- If a product has multiple, pick the one with the lowest cost_per_lb.

ALTER TABLE "product_supplier_costs"
  ADD COLUMN "is_primary" boolean NOT NULL DEFAULT false,
  ADD COLUMN "last_received_at" timestamp with time zone;

-- Mark one row per product as primary (lowest cost wins for existing data).
UPDATE "product_supplier_costs" psc
SET "is_primary" = true
WHERE psc.id IN (
  SELECT DISTINCT ON (product_id) id
  FROM "product_supplier_costs"
  ORDER BY product_id, cost_per_lb ASC, updated_at ASC
);
