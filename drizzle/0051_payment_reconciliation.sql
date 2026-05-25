-- Bulk reconciliation columns on both payment tables. End-of-month
-- workflow: ops opens the bank statement, multi-selects the matching
-- payment rows in the app, marks them reconciled with the statement's
-- reference. The columns are independent of the Plaid match infrastructure
-- so tenants without bank-feed integration can still use the feature.
--
-- All columns are nullable and have no default — unreconciled is the
-- absence of a timestamp, not a boolean flag.

ALTER TABLE "payments"
  ADD COLUMN "reconciled_at" timestamp with time zone,
  ADD COLUMN "reconciled_by_user_id" uuid REFERENCES "portal_users"("id") ON DELETE SET NULL,
  ADD COLUMN "reconciliation_reference" varchar(255);

ALTER TABLE "supplier_invoice_payments"
  ADD COLUMN "reconciled_at" timestamp with time zone,
  ADD COLUMN "reconciled_by_user_id" uuid REFERENCES "portal_users"("id") ON DELETE SET NULL,
  ADD COLUMN "reconciliation_reference" varchar(255);

-- Partial indexes for the default "unreconciled" filter on each listing.
-- Sized small (only rows with reconciled_at IS NULL) so they're cheap.
CREATE INDEX "payments_unreconciled_idx"
  ON "payments" ("tenant_id", "payment_date")
  WHERE "reconciled_at" IS NULL;

CREATE INDEX "supplier_invoice_payments_unreconciled_idx"
  ON "supplier_invoice_payments" ("tenant_id", "payment_date")
  WHERE "reconciled_at" IS NULL;
