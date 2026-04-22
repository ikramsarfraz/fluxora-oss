ALTER TABLE "sales_order_lines"
  ADD COLUMN IF NOT EXISTS "sales_unit_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_order_lines_sales_unit_id_units_of_measure_id_fk'
  ) THEN
    ALTER TABLE "sales_order_lines"
      ADD CONSTRAINT "sales_order_lines_sales_unit_id_units_of_measure_id_fk"
      FOREIGN KEY ("sales_unit_id")
      REFERENCES "public"."units_of_measure"("id")
      ON DELETE restrict
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_lines_sales_unit_id_idx"
  ON "sales_order_lines" USING btree ("sales_unit_id");
--> statement-breakpoint
ALTER TABLE "sales_order_lines"
  ADD COLUMN IF NOT EXISTS "conversion_to_base_snapshot" numeric(12, 4),
  ADD COLUMN IF NOT EXISTS "base_unit_id_snapshot" uuid,
  ADD COLUMN IF NOT EXISTS "sales_unit_name_snapshot" varchar(128),
  ADD COLUMN IF NOT EXISTS "sales_unit_abbreviation_snapshot" varchar(16);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_order_lines_base_unit_id_snapshot_units_of_measure_id_fk'
  ) THEN
    ALTER TABLE "sales_order_lines"
      ADD CONSTRAINT "sales_order_lines_base_unit_id_snapshot_units_of_measure_id_fk"
      FOREIGN KEY ("base_unit_id_snapshot")
      REFERENCES "public"."units_of_measure"("id")
      ON DELETE restrict
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_lines_base_unit_snapshot_id_idx"
  ON "sales_order_lines" USING btree ("base_unit_id_snapshot");
--> statement-breakpoint
WITH default_sales_units AS (
  SELECT DISTINCT ON (pu.product_id)
    pu.product_id,
    pu.unit_id
  FROM "product_units" pu
  WHERE pu.purpose = 'sales'
  ORDER BY pu.product_id, pu.is_default DESC, pu.sort_order ASC, pu.created_at ASC
)
UPDATE "sales_order_lines" sol
SET "sales_unit_id" = dsu.unit_id
FROM default_sales_units dsu
WHERE sol.product_id = dsu.product_id
  AND sol.sales_unit_id IS NULL;
--> statement-breakpoint
UPDATE "sales_order_lines" sol
SET
  "conversion_to_base_snapshot" = pu.conversion_to_base,
  "base_unit_id_snapshot" = p.base_unit_id,
  "sales_unit_name_snapshot" = u.name,
  "sales_unit_abbreviation_snapshot" = u.abbreviation
FROM "product_units" pu
JOIN "products" p ON p.id = pu.product_id
JOIN "units_of_measure" u ON u.id = pu.unit_id
WHERE pu.product_id = sol.product_id
  AND pu.unit_id = sol.sales_unit_id
  AND pu.purpose = 'sales'
  AND (
    sol.conversion_to_base_snapshot IS NULL
    OR sol.base_unit_id_snapshot IS NULL
    OR sol.sales_unit_name_snapshot IS NULL
    OR sol.sales_unit_abbreviation_snapshot IS NULL
  );
