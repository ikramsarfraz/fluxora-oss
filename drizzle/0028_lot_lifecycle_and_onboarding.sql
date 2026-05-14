-- ── New enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."lot_state" AS ENUM('active', 'expiring', 'marked_down', 'reserved', 'donated', 'repurposed', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."disposition_option" AS ENUM('markdown', 'outreach', 'donate', 'repurpose', 'discard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."disposition_status" AS ENUM('draft', 'scheduled', 'applied', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."business_category" AS ENUM('meat_poultry', 'seafood', 'produce', 'bakery_dry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ── tenants: onboarding fields ─────────────────────────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "business_category" "business_category";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "bill_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint

-- ── lots: lifecycle state ──────────────────────────────────────────────────
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "state" "lot_state" NOT NULL DEFAULT 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lots_state" ON "lots" ("state");--> statement-breakpoint

-- ── disposition_decisions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "disposition_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "decided_by_user_id" uuid NOT NULL,
  "option" "disposition_option" NOT NULL,
  "status" "disposition_status" NOT NULL DEFAULT 'draft',
  "expected_net" numeric(12, 2),
  "actual_net" numeric(12, 2),
  "config" jsonb NOT NULL DEFAULT '{}',
  "scheduled_for" timestamp with time zone,
  "applied_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "disposition_decisions_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "disposition_decisions_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT,
  CONSTRAINT "disposition_decisions_decided_by_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disposition_decisions_tenant_id_idx" ON "disposition_decisions" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disposition_decisions_lot_id_idx" ON "disposition_decisions" ("lot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disposition_decisions_status_idx" ON "disposition_decisions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disposition_decisions_option_idx" ON "disposition_decisions" ("option");--> statement-breakpoint

-- ── markdown_histories ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "markdown_histories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "lot_id" uuid,
  "disposition_decision_id" uuid,
  "product_category" varchar(128) NOT NULL,
  "discount_percent" numeric(5, 2) NOT NULL,
  "quantity_offered_lbs" numeric(12, 4) NOT NULL,
  "actual_sell_through_pct" numeric(5, 2),
  "expected_net" numeric(12, 2),
  "actual_net" numeric(12, 2),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "markdown_histories_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "markdown_histories_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL,
  CONSTRAINT "markdown_histories_disposition_decision_id_fk" FOREIGN KEY ("disposition_decision_id") REFERENCES "disposition_decisions"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_histories_tenant_id_idx" ON "markdown_histories" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_histories_product_category_idx" ON "markdown_histories" ("product_category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_histories_completed_at_idx" ON "markdown_histories" ("completed_at");
