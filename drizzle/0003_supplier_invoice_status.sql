DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'supplier_invoice_status'
  ) THEN
    CREATE TYPE "public"."supplier_invoice_status" AS ENUM ('draft', 'completed');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "supplier_invoices"
  ADD COLUMN IF NOT EXISTS "receive_date" date,
  ADD COLUMN IF NOT EXISTS "status" "supplier_invoice_status" DEFAULT 'draft' NOT NULL,
  ADD COLUMN IF NOT EXISTS "completed_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
-- Backfill receive_date on any rows that predate this migration. We use
-- invoice_date as a reasonable fallback; operators can correct post-hoc if
-- the receive date actually differed.
UPDATE "supplier_invoices"
SET "receive_date" = "invoice_date"
WHERE "receive_date" IS NULL;
--> statement-breakpoint
-- Existing invoices that already have at least one lot receipt have
-- effectively been received; surface them as completed so the new status
-- column reflects reality instead of silently marking history as draft.
UPDATE "supplier_invoices" si
SET
  "status" = 'completed',
  "completed_at" = si."updated_at"
WHERE EXISTS (
  SELECT 1
  FROM "supplier_invoice_lines" sil
  JOIN "lot_receipts" lr ON lr.supplier_invoice_line_id = sil.id
  WHERE sil.supplier_invoice_id = si.id
);
--> statement-breakpoint
ALTER TABLE "supplier_invoices"
  ALTER COLUMN "receive_date" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplier_invoices_completed_by_user_id_portal_users_id_fk'
  ) THEN
    ALTER TABLE "supplier_invoices"
      ADD CONSTRAINT "supplier_invoices_completed_by_user_id_portal_users_id_fk"
      FOREIGN KEY ("completed_by_user_id")
      REFERENCES "public"."portal_users"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_invoices_tenant_status_idx"
  ON "supplier_invoices" USING btree ("tenant_id", "status");
