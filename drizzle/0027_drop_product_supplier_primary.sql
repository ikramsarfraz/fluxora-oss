-- Drop is_primary from product_supplier_costs. The notion of a single
-- "primary" supplier per product has been removed; the price-chart and the
-- order-fulfillment fallback now order vendors by cost_per_lb ascending.

ALTER TABLE "product_supplier_costs" DROP COLUMN "is_primary";
