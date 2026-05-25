-- Soft-delete tombstone for expenses (issue #270).
--
-- Hand-written exception to the "no hand-written SQL" rule because
-- `pnpm db:generate` is currently blocked on the drizzle/meta/ snapshot
-- drift: only 8 snapshot files exist for 65 journal entries, so the
-- tool prompts column-rename disambiguation for every column added
-- since 0030 and can't run non-interactively. Filed as its own issue;
-- once the snapshots are regenerated, future migrations go through the
-- normal `pnpm db:generate` flow.
--
-- The columns + index here mirror the schema declaration in db/schema.ts
-- exactly. ON DELETE SET NULL on the FK so the tombstone survives a
-- deleted portal user (audit trail must not unravel).

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "deleted_by_user_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_deleted_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expenses_tenant_deleted_at_idx"
  ON "expenses" USING btree ("tenant_id","deleted_at");
