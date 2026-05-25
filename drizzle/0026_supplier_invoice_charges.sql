CREATE TABLE IF NOT EXISTS "supplier_invoice_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"description" varchar(256) NOT NULL,
	"charge_type" varchar(32) NOT NULL DEFAULT 'other',
	"rate" numeric(8, 4),
	"include_in_inventory_cost" boolean NOT NULL DEFAULT false,
	"amount" numeric(12, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invoice_charges_charge_type_check" CHECK ("charge_type" IN ('freight','fuel','tax','discount','other'))
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoice_charges_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "supplier_invoice_charges" ADD CONSTRAINT "supplier_invoice_charges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoice_charges_supplier_invoice_id_supplier_invoices_id_fk') THEN
    ALTER TABLE "supplier_invoice_charges" ADD CONSTRAINT "supplier_invoice_charges_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_invoice_charges_invoice_id_idx" ON "supplier_invoice_charges" USING btree ("supplier_invoice_id");
