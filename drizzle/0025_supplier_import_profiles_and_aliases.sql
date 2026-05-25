CREATE TYPE "public"."alias_source" AS ENUM('manual', 'ai_suggested', 'confirmed', 'parser');--> statement-breakpoint
CREATE TYPE "public"."parser_type" AS ENUM('deterministic', 'ai_fallback', 'hybrid');--> statement-breakpoint
CREATE TABLE "supplier_import_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"profile_name" varchar(128) NOT NULL,
	"detection_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parser_type" "parser_type" DEFAULT 'deterministic' NOT NULL,
	"parsing_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_threshold" numeric(5, 2) DEFAULT '60' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_product_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"vendor_product_name" varchar(256) NOT NULL,
	"normalized_vendor_product_name" varchar(256) NOT NULL,
	"internal_product_id" uuid NOT NULL,
	"confidence" numeric(5, 2) DEFAULT '100' NOT NULL,
	"source" "alias_source" DEFAULT 'manual' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_import_profiles" ADD CONSTRAINT "supplier_import_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_import_profiles" ADD CONSTRAINT "supplier_import_profiles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_import_profiles" ADD CONSTRAINT "supplier_import_profiles_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_internal_product_id_products_id_fk" FOREIGN KEY ("internal_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_created_by_user_id_portal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_import_profiles_tenant_id_idx" ON "supplier_import_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_import_profiles_supplier_id_idx" ON "supplier_import_profiles" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_import_profiles_tenant_supplier_name_unique" ON "supplier_import_profiles" USING btree ("tenant_id","supplier_id","profile_name");--> statement-breakpoint
CREATE INDEX "supplier_product_aliases_tenant_id_idx" ON "supplier_product_aliases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_product_aliases_supplier_id_idx" ON "supplier_product_aliases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_product_aliases_product_id_idx" ON "supplier_product_aliases" USING btree ("internal_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_product_aliases_tenant_supplier_name_unique" ON "supplier_product_aliases" USING btree ("tenant_id","supplier_id","normalized_vendor_product_name");