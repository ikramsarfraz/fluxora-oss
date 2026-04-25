ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "setup_checklist_dismissed_at" timestamp with time zone;
