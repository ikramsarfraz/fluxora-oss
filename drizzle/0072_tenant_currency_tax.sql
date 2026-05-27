CREATE TYPE "public"."tenant_base_currency" AS ENUM('USD', 'EUR', 'GBP', 'CAD');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "base_currency" "tenant_base_currency" DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "tax_inclusive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_tax_rate" numeric(5, 4);