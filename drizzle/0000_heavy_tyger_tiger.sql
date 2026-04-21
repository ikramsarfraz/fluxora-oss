CREATE TYPE "public"."address_type" AS ENUM('billing', 'shipping', 'warehouse', 'other');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('insert', 'update', 'delete', 'soft_delete', 'restore', 'login', 'logout', 'invite_sent', 'invite_accepted', 'file_uploaded', 'file_deleted', 'tenant_accessed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('portal_user', 'platform_user', 'system');--> statement-breakpoint
CREATE TYPE "public"."credit_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."file_category" AS ENUM('tenant_branding', 'supplier_invoice_attachment', 'sales_invoice_pdf', 'sales_invoice_attachment', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('uploading', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."file_storage_provider" AS ENUM('r2');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_status" AS ENUM('in_stock', 'allocated', 'sold', 'damaged', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."line_unit_type" AS ENUM('catch_weight', 'fixed_case');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('sales_order', 'confirmed', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'ach', 'zelle', 'credit_card');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('platform_admin', 'support', 'qa');--> statement-breakpoint
CREATE TYPE "public"."product_unit_purpose" AS ENUM('stock', 'purchase', 'sales', 'pricing', 'display');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'sales', 'warehouse', 'accounting');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_portal_user_id" uuid,
	"actor_platform_user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_table" varchar(128) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"entity_label" varchar(255),
	"changed_fields_json" text,
	"before_json" text,
	"after_json" text,
	"context_json" text,
	"request_id" varchar(128),
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_type" "address_type" DEFAULT 'shipping' NOT NULL,
	"street" varchar(255) NOT NULL,
	"city" varchar(128),
	"state" varchar(64),
	"zip" varchar(32),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_per_lb" numeric(10, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone_number" varchar(64),
	"fuel_surcharge_amount" numeric(10, 2),
	"invoice_prefix" varchar(32),
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"category" varchar(64) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"payment_method" "payment_method",
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_nonnegative" CHECK ("expenses"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" "file_category" NOT NULL,
	"storage_provider" "file_storage_provider" DEFAULT 'r2' NOT NULL,
	"status" "file_status" DEFAULT 'ready' NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"bucket" varchar(255),
	"original_filename" varchar(512),
	"mime_type" varchar(255),
	"extension" varchar(32),
	"size_bytes" integer,
	"checksum_sha256" varchar(128),
	"uploaded_by_user_id" uuid,
	"archived_by_user_id" uuid,
	"metadata_json" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"barcode_id" varchar(128) NOT NULL,
	"exact_weight_lbs" numeric(10, 4) NOT NULL,
	"cases" integer DEFAULT 1 NOT NULL,
	"status" "inventory_item_status" DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_barcode_id_unique" UNIQUE("barcode_id")
);
--> statement-breakpoint
CREATE TABLE "lot_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"supplier_invoice_line_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lot_number" varchar(128) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"receive_date" date NOT NULL,
	"expiration_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"check_number" varchar(64),
	"reference_number" varchar(128),
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"role" "platform_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_pkey" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_supplier_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"cost_per_lb" numeric(10, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"purpose" "product_unit_purpose" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"conversion_to_base" numeric(12, 4) NOT NULL,
	"allows_fractional" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"default_price_per_lb" numeric(10, 4) NOT NULL,
	"base_unit_id" uuid,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_files" (
	"sales_invoice_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"kind" "file_category" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoice_files_pkey" PRIMARY KEY("sales_invoice_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_cases" integer DEFAULT 0 NOT NULL,
	"billed_weight_lbs" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit_type" "credit_type",
	"credit_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fuel_surcharge_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_line_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"allocated_weight_lbs" numeric(10, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"expected_cases" integer NOT NULL,
	"fulfilled_cases" integer DEFAULT 0 NOT NULL,
	"unit_type" "line_unit_type" DEFAULT 'catch_weight' NOT NULL,
	"total_billed_weight_lbs" numeric(12, 4) DEFAULT '0' NOT NULL,
	"price_per_lb_override" numeric(10, 4),
	"case_weights_lbs" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_number" varchar(32),
	"customer_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"due_date" date,
	"status" "order_status" DEFAULT 'sales_order' NOT NULL,
	"add_fuel_surcharge" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_attachments" (
	"supplier_invoice_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invoice_attachments_pkey" PRIMARY KEY("supplier_invoice_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_cases" integer DEFAULT 0 NOT NULL,
	"weight_lbs" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"line_total" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit_type" "line_unit_type" DEFAULT 'catch_weight' NOT NULL,
	"case_weights_lbs" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"invoice_date" date NOT NULL,
	"total_amount" numeric(12, 4) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_method" "payment_method",
	"notes" text,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_legal_name" varchar(255),
	"display_name" varchar(255),
	"primary_color" varchar(32),
	"secondary_color" varchar(32),
	"accent_color" varchar(32),
	"invoice_footer_text" text,
	"invoice_notes_default" text,
	"logo_file_id" uuid,
	"favicon_file_id" uuid,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"abbreviation" varchar(16),
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_of_measure_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_portal_user_id_portal_users_id_fk" FOREIGN KEY ("actor_portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_platform_user_id_platform_users_id_fk" FOREIGN KEY ("actor_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_archived_by_user_id_portal_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_archived_by_user_id_portal_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_portal_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_archived_by_user_id_portal_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_receipts" ADD CONSTRAINT "lot_receipts_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_receipts" ADD CONSTRAINT "lot_receipts_supplier_invoice_line_id_supplier_invoice_lines_id_fk" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supplier_costs" ADD CONSTRAINT "product_supplier_costs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supplier_costs" ADD CONSTRAINT "product_supplier_costs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_unit_id_units_of_measure_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_archived_by_user_id_portal_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_files" ADD CONSTRAINT "sales_invoice_files_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_files" ADD CONSTRAINT "sales_invoice_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_line_allocations" ADD CONSTRAINT "sales_order_line_allocations_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_line_allocations" ADD CONSTRAINT "sales_order_line_allocations_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_attachments" ADD CONSTRAINT "supplier_invoice_attachments_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_attachments" ADD CONSTRAINT "supplier_invoice_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_archived_by_user_id_portal_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_updated_by_user_id_portal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_portal_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_at_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_table","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_portal_user_idx" ON "audit_logs" USING btree ("actor_portal_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_platform_user_idx" ON "audit_logs" USING btree ("actor_platform_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_name_unique" ON "categories" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_slug_unique" ON "categories" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "categories_tenant_id_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categories_is_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "categories_archived_at_idx" ON "categories" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_product" ON "customer_product_prices" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_name_unique" ON "customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "customers_archived_at_idx" ON "customers" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "expenses_tenant_id_idx" ON "expenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_object_key_unique" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "files_tenant_created_at_idx" ON "files" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "files_tenant_category_created_at_idx" ON "files" USING btree ("tenant_id","category","created_at");--> statement-breakpoint
CREATE INDEX "files_tenant_status_created_at_idx" ON "files" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "files_archived_at_idx" ON "files" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "ix_inventory_items_lot_id" ON "inventory_items" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_items_status" ON "inventory_items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "lot_receipts_lot_invoice_line_unique" ON "lot_receipts" USING btree ("lot_id","supplier_invoice_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_tenant_lot_number_unique" ON "lots" USING btree ("tenant_id","lot_number");--> statement-breakpoint
CREATE INDEX "lots_tenant_id_idx" ON "lots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ix_lots_expiration_date" ON "lots" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "payments_tenant_id_idx" ON "payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_sales_invoice_id_idx" ON "payments" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_payment_date_idx" ON "payments" USING btree ("tenant_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_auth_user_id_unique" ON "platform_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "platform_users_role_idx" ON "platform_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "platform_users_is_active_idx" ON "platform_users" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_users_auth_user_id_tenant_id_unique" ON "portal_users" USING btree ("auth_user_id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_users_tenant_email_unique" ON "portal_users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "portal_users_auth_user_id_idx" ON "portal_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "portal_users_tenant_id_idx" ON "portal_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "portal_users_email_idx" ON "portal_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "portal_users_is_active_idx" ON "portal_users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "portal_users_role_idx" ON "portal_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "product_categories_product_id_idx" ON "product_categories" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_id_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_supplier_cost" ON "product_supplier_costs" USING btree ("product_id","supplier_id");--> statement-breakpoint
CREATE INDEX "product_units_product_id_idx" ON "product_units" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_units_unit_id_idx" ON "product_units" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "product_units_product_purpose_idx" ON "product_units" USING btree ("product_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_product_unit_purpose_unique" ON "product_units" USING btree ("product_id","unit_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku_unique" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_base_unit_id_idx" ON "products" USING btree ("base_unit_id");--> statement-breakpoint
CREATE INDEX "products_archived_at_idx" ON "products" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "sales_invoice_files_file_id_idx" ON "sales_invoice_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_files_sales_invoice_id_kind_idx" ON "sales_invoice_files" USING btree ("sales_invoice_id","kind");--> statement-breakpoint
CREATE INDEX "sales_invoice_lines_sales_invoice_id_idx" ON "sales_invoice_lines" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_lines_product_id_idx" ON "sales_invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_tenant_id_idx" ON "sales_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_customer_id_idx" ON "sales_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_sales_order_id_idx" ON "sales_invoices" USING btree ("sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_invoices_tenant_invoice_number_unique" ON "sales_invoices" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "sales_invoices_tenant_invoice_date_idx" ON "sales_invoices" USING btree ("tenant_id","invoice_date");--> statement-breakpoint
CREATE INDEX "sales_invoices_tenant_status_due_date_idx" ON "sales_invoices" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_line_inventory_item" ON "sales_order_line_allocations" USING btree ("sales_order_line_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_lines_product_id_idx" ON "sales_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_orders_tenant_id_idx" ON "sales_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_tenant_order_number_unique" ON "sales_orders" USING btree ("tenant_id","order_number");--> statement-breakpoint
CREATE INDEX "sales_orders_tenant_order_date_idx" ON "sales_orders" USING btree ("tenant_id","order_date");--> statement-breakpoint
CREATE INDEX "supplier_invoice_attachments_file_id_idx" ON "supplier_invoice_attachments" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_supplier_invoice_id_idx" ON "supplier_invoice_lines" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_product_id_idx" ON "supplier_invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_tenant_id_idx" ON "supplier_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_tenant_invoice_number_unique" ON "supplier_invoices" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "supplier_invoices_tenant_invoice_date_idx" ON "supplier_invoices" USING btree ("tenant_id","invoice_date");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tenant_name_unique" ON "suppliers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "suppliers_archived_at_idx" ON "suppliers" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_branding_tenant_id_unique" ON "tenant_branding" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_unique" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tenants_is_active_idx" ON "tenants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "units_of_measure_is_active_idx" ON "units_of_measure" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_invitations_tenant_id_idx" ON "user_invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_token_idx" ON "user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");