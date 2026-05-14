-- Phase 8: Plaid bill reconciliation + Forward bill
-- Only contains genuinely new additions (0026-0029 were manually written without snapshots)

CREATE TYPE "public"."bank_transaction_channel" AS ENUM('ach', 'wire', 'check', 'other');--> statement-breakpoint
CREATE TYPE "public"."bill_forward_delivery_status" AS ENUM('sent', 'bounced', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."payment_match_status" AS ENUM('pending_review', 'confirmed', 'auto_applied', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."plaid_connection_status" AS ENUM('active', 'requires_reauth', 'disconnected');--> statement-breakpoint
ALTER TYPE "public"."supplier_invoice_status" ADD VALUE IF NOT EXISTS 'paid';--> statement-breakpoint
CREATE TABLE "plaid_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plaid_item_id" varchar(256) NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"institution_id" varchar(128),
	"institution_name" varchar(256),
	"status" "plaid_connection_status" DEFAULT 'active' NOT NULL,
	"transaction_cursor" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plaid_connection_id" uuid NOT NULL,
	"plaid_account_id" varchar(256) NOT NULL,
	"name" varchar(256) NOT NULL,
	"official_name" varchar(256),
	"mask" varchar(8),
	"type" varchar(64) NOT NULL,
	"subtype" varchar(64),
	"current_balance" numeric(14, 2),
	"available_balance" numeric(14, 2),
	"iso_currency_code" varchar(8) DEFAULT 'USD',
	"balance_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"plaid_transaction_id" varchar(256) NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"merchant_name" varchar(256),
	"raw_description" text NOT NULL,
	"payment_channel" "bank_transaction_channel" DEFAULT 'other',
	"pending" boolean DEFAULT false NOT NULL,
	"iso_currency_code" varchar(8) DEFAULT 'USD',
	"plaid_category" jsonb DEFAULT '[]'::jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"status" "payment_match_status" DEFAULT 'pending_review' NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"auto_applied" boolean DEFAULT false NOT NULL,
	"amount_score" numeric(5, 4),
	"payee_score" numeric(5, 4),
	"timing_score" numeric(5, 4),
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payee_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"normalized_text" varchar(512) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"source" "alias_source" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_forwards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"sent_by_user_id" uuid,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"message_body" text NOT NULL,
	"attached_original" boolean DEFAULT true NOT NULL,
	"attached_summary" boolean DEFAULT false NOT NULL,
	"delivery_status" "bill_forward_delivery_status" DEFAULT 'sent' NOT NULL,
	"delivery_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plaid_connections" ADD CONSTRAINT "plaid_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_plaid_connection_id_plaid_connections_id_fk" FOREIGN KEY ("plaid_connection_id") REFERENCES "public"."plaid_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_matches" ADD CONSTRAINT "payment_matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_matches" ADD CONSTRAINT "payment_matches_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_matches" ADD CONSTRAINT "payment_matches_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_matches" ADD CONSTRAINT "payment_matches_confirmed_by_user_id_portal_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee_aliases" ADD CONSTRAINT "payee_aliases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee_aliases" ADD CONSTRAINT "payee_aliases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_forwards" ADD CONSTRAINT "bill_forwards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_forwards" ADD CONSTRAINT "bill_forwards_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_forwards" ADD CONSTRAINT "bill_forwards_sent_by_user_id_portal_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plaid_connections_tenant_id_idx" ON "plaid_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plaid_connections_plaid_item_id_unique" ON "plaid_connections" USING btree ("plaid_item_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_tenant_id_idx" ON "bank_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_connection_id_idx" ON "bank_accounts" USING btree ("plaid_connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_plaid_account_id_unique" ON "bank_accounts" USING btree ("plaid_account_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_tenant_id_idx" ON "bank_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_account_id_idx" ON "bank_transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_plaid_txn_id_unique" ON "bank_transactions" USING btree ("plaid_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_matches_tenant_id_idx" ON "payment_matches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_matches_txn_id_idx" ON "payment_matches" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_matches_invoice_id_idx" ON "payment_matches" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "payment_matches_status_idx" ON "payment_matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payee_aliases_tenant_id_idx" ON "payee_aliases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payee_aliases_supplier_id_idx" ON "payee_aliases" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payee_aliases_tenant_normalized_unique" ON "payee_aliases" USING btree ("tenant_id","normalized_text");--> statement-breakpoint
CREATE INDEX "bill_forwards_tenant_id_idx" ON "bill_forwards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bill_forwards_invoice_id_idx" ON "bill_forwards" USING btree ("supplier_invoice_id");
