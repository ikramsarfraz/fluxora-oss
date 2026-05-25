-- Partial unique indexes on payment_matches to close the dedup race
-- (issue #269). The matcher's check-then-insert can race when sync +
-- a manual link confirm fire concurrently, creating two pending matches
-- for the same (bank_txn, invoice) pair.
--
-- Two indexes — one per direction — because exactly one of
-- supplier_invoice_id / sales_invoice_id is set per match row.
-- WHERE status != 'rejected' so a rejected match doesn't block a
-- later re-match attempt against the same pair.
--
-- Tenant scope folded into the key so the index is well-aligned with
-- how the matcher actually queries.
--
-- Hand-written for the same reason as 0065 — see issue #287 for the
-- pnpm db:generate snapshot drift blocker.

CREATE UNIQUE INDEX IF NOT EXISTS "payment_matches_tenant_txn_supplier_unique"
  ON "payment_matches" USING btree (
    "tenant_id",
    "bank_transaction_id",
    "supplier_invoice_id"
  )
  WHERE "supplier_invoice_id" IS NOT NULL AND "status" != 'rejected';--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_matches_tenant_txn_sales_unique"
  ON "payment_matches" USING btree (
    "tenant_id",
    "bank_transaction_id",
    "sales_invoice_id"
  )
  WHERE "sales_invoice_id" IS NOT NULL AND "status" != 'rejected';
