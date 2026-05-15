-- Rename `supplier_invoices.invoice_number` → `supplier_invoice_number` to
-- make it explicit this is the supplier's printed number (not the system's
-- reference). Make it nullable so bills without a printed number can be
-- recorded cleanly. Replace the tenant-unique constraint with a partial
-- unique on (tenant, supplier, supplier_invoice_number) WHERE NOT NULL so
-- duplicate-import detection still works per-supplier while still allowing
-- multiple null rows.

ALTER TABLE "supplier_invoices" RENAME COLUMN "invoice_number" TO "supplier_invoice_number";--> statement-breakpoint
ALTER TABLE "supplier_invoices" ALTER COLUMN "supplier_invoice_number" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "supplier_invoices_tenant_invoice_number_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_tenant_supplier_inv_number_unique" ON "supplier_invoices" USING btree ("tenant_id","supplier_id","supplier_invoice_number") WHERE "supplier_invoice_number" IS NOT NULL;
