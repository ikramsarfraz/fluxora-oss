DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'pricing_unit_type'
  ) THEN
    CREATE TYPE "public"."pricing_unit_type" AS ENUM ('per_lb', 'per_case');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "sales_order_lines"
  ADD COLUMN IF NOT EXISTS "pricing_unit_type_snapshot" "public"."pricing_unit_type",
  ADD COLUMN IF NOT EXISTS "price_per_unit_snapshot" numeric(12, 4),
  ADD COLUMN IF NOT EXISTS "pricing_conversion_snapshot" numeric(12, 4);
--> statement-breakpoint
UPDATE "sales_order_lines" sol
SET
  "pricing_unit_type_snapshot" = CASE
    WHEN sol.unit_type = 'fixed_case' THEN 'per_case'::"public"."pricing_unit_type"
    ELSE 'per_lb'::"public"."pricing_unit_type"
  END,
  "price_per_unit_snapshot" = CASE
    WHEN sol.unit_type = 'fixed_case'
      AND sol.conversion_to_base_snapshot IS NOT NULL
      AND sol.conversion_to_base_snapshot > 0
      THEN COALESCE(sol.price_per_lb_override, p.default_price_per_lb)
           * sol.conversion_to_base_snapshot
    ELSE COALESCE(sol.price_per_lb_override, p.default_price_per_lb)
  END,
  "pricing_conversion_snapshot" = CASE
    WHEN sol.unit_type = 'fixed_case' THEN sol.conversion_to_base_snapshot
    ELSE NULL
  END
FROM "products" p
WHERE p.id = sol.product_id
  AND sol.pricing_unit_type_snapshot IS NULL;
