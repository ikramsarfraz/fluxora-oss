CREATE TABLE IF NOT EXISTS "supplier_invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference" varchar(128),
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invoice_payments_amount_positive" CHECK ("amount" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'supplier_invoice_payments_tenant_id_tenants_id_fk'
	) THEN
		ALTER TABLE "supplier_invoice_payments"
			ADD CONSTRAINT "supplier_invoice_payments_tenant_id_tenants_id_fk"
			FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
			ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'supplier_invoice_payments_supplier_invoice_id_supplier_invoices_id_fk'
	) THEN
		ALTER TABLE "supplier_invoice_payments"
			ADD CONSTRAINT "supplier_invoice_payments_supplier_invoice_id_supplier_invoices_id_fk"
			FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'supplier_invoice_payments_created_by_user_id_portal_users_id_fk'
	) THEN
		ALTER TABLE "supplier_invoice_payments"
			ADD CONSTRAINT "supplier_invoice_payments_created_by_user_id_portal_users_id_fk"
			FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id")
			ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_invoice_payments_tenant_id_idx" ON "supplier_invoice_payments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_invoice_payments_supplier_invoice_id_idx" ON "supplier_invoice_payments" USING btree ("supplier_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_invoice_payments_tenant_payment_date_idx" ON "supplier_invoice_payments" USING btree ("tenant_id","payment_date");
