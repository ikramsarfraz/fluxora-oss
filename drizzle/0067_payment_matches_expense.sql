-- Expense ↔ bank-transaction reconciliation (issue #258).
--
-- The expenses module and the bank-feed had no way to talk about the same
-- money. A subscription debit lands on bank-activity as "Unmatched" while
-- the user-recorded expense for the same charge sits on /expenses with
-- no link. This migration extends payment_matches to support an expense
-- target alongside the existing supplier_invoice + sales_invoice targets.
--
-- Hand-written exception (see issue #287 for the snapshot drift).
--
-- Three pieces:
--   1. ADD expense_id column + FK (ON DELETE RESTRICT — same as the
--      other two FKs; tombstoning happens via expenses.deleted_at).
--   2. Replace the two-target CHECK with a three-target version.
--   3. ADD partial unique index for dedup, mirroring the AP/AR pair.

ALTER TABLE "payment_matches"
  ADD COLUMN IF NOT EXISTS "expense_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "payment_matches"
    ADD CONSTRAINT "payment_matches_expense_id_expenses_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "payment_matches"
  DROP CONSTRAINT IF EXISTS "payment_matches_one_invoice_only";--> statement-breakpoint

ALTER TABLE "payment_matches"
  ADD CONSTRAINT "payment_matches_one_target_only"
  CHECK ((
    (CASE WHEN "supplier_invoice_id" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "sales_invoice_id" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "expense_id" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_matches_expense_id_idx"
  ON "payment_matches" USING btree ("expense_id");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_matches_tenant_txn_expense_unique"
  ON "payment_matches" USING btree (
    "tenant_id",
    "bank_transaction_id",
    "expense_id"
  )
  WHERE "expense_id" IS NOT NULL AND "status" != 'rejected';
