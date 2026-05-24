-- Expense approval workflow.
--
-- Adds a status enum + per-transition timestamp + actor FK + a rejection
-- reason to expenses. State machine (enforced in service code, not DB):
--
--   draft   --submit-->  submitted
--   submitted --approve--> approved
--   submitted --reject-->  rejected
--   rejected --reset-->   draft
--   approved --mark_paid--> paid
--
-- Backfill: rows that existed before this migration shipped get
-- status='approved' so the new filter doesn't suddenly hide a tenant's
-- historical entries from the listing. Newly-created rows go to 'draft'
-- via the column default.

CREATE TYPE "public"."expense_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid');--> statement-breakpoint

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "status" "public"."expense_status";--> statement-breakpoint

-- Backfill before applying NOT NULL + default; existing rows predate the
-- workflow and should be treated as already-approved.
UPDATE "expenses" SET "status" = 'approved' WHERE "status" IS NULL;--> statement-breakpoint

ALTER TABLE "expenses"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "submitted_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "rejected_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text,
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "paid_by_user_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_submitted_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_approved_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_rejected_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_paid_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expenses_tenant_status_idx"
  ON "expenses" USING btree ("tenant_id","status");
