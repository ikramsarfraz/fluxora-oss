-- Three independent safety nets, batched into one migration:
--
--  1. payments.batch_id — groups N rows produced by a single bulk-payment
--     submit (one check applied across N invoices). Combined with the
--     existing idempotency_key column on the anchor row, a retried bulk
--     submit looks up the anchor by key, reads its batch_id, and returns
--     the existing batch instead of inserting duplicate rows.
--
--  2. supplier_invoices.reverse_idempotency_key — destructive reverse path
--     (deletes lots, inventory items, audit rows). Mirrors the AR payment
--     contract: client UUID per submit, partial unique index per tenant,
--     service catches 23505 and returns the already-reversed invoice
--     state instead of re-executing the cascade.
--
--  3. customer_product_prices.version — optimistic-concurrency token.
--     Writes carry the version they read; the conditional UPDATE matches
--     0 rows when the row has moved on, and the service throws so the
--     client can refetch and let the user pick a side. Without this two
--     simultaneous edits silently last-write-wins.
--
-- All columns are nullable / default 0 so backfill is implicit.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "batch_id" uuid;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payments_tenant_batch_id_idx"
  ON "payments" USING btree ("tenant_id","batch_id")
  WHERE "batch_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "supplier_invoices"
  ADD COLUMN IF NOT EXISTS "reverse_idempotency_key" uuid;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoices_tenant_reverse_idempotency_key_unique"
  ON "supplier_invoices" USING btree ("tenant_id","reverse_idempotency_key")
  WHERE "reverse_idempotency_key" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "customer_product_prices"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
