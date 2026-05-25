CREATE TABLE "bank_account_balance_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "balance" numeric(14, 2) NOT NULL,
  "available_balance" numeric(14, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_account_balance_snapshots" ADD CONSTRAINT "bank_account_balance_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bank_account_balance_snapshots" ADD CONSTRAINT "bank_account_balance_snapshots_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "balance_snapshots_account_date_unique" ON "bank_account_balance_snapshots" USING btree ("bank_account_id","snapshot_date");
--> statement-breakpoint
CREATE INDEX "balance_snapshots_tenant_date_idx" ON "bank_account_balance_snapshots" USING btree ("tenant_id","snapshot_date");
