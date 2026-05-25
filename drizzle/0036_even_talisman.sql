DROP INDEX "uq_customer_product";--> statement-breakpoint
ALTER TABLE "customer_product_prices" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- NULLS NOT DISTINCT (PG 15+) so the "default" row (supplier_id IS NULL) is unique per (customer, product) too.
CREATE UNIQUE INDEX "uq_customer_product_supplier" ON "customer_product_prices" USING btree ("customer_id","product_id","supplier_id") NULLS NOT DISTINCT;