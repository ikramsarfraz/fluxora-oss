-- Extend payment_matches to support AR (sales_invoices) matching in
-- addition to the existing AP (supplier_invoices) matching. Previously
-- the bank-transaction matcher could only link outflows to bills;
-- inflows from customers had no path to a match row.
--
-- Schema change:
--   - Drop NOT NULL on supplier_invoice_id (it was required before).
--   - Add sales_invoice_id (uuid, nullable, FK to sales_invoices).
--   - CHECK constraint: exactly one of the two FK columns must be set.
--   - Index on sales_invoice_id.
--
-- Existing rows all have supplier_invoice_id set, so they satisfy the
-- new CHECK on first migration pass.

ALTER TABLE "payment_matches"
  ALTER COLUMN "supplier_invoice_id" DROP NOT NULL;

ALTER TABLE "payment_matches"
  ADD COLUMN "sales_invoice_id" uuid REFERENCES "sales_invoices"("id") ON DELETE RESTRICT;

CREATE INDEX "payment_matches_sales_invoice_id_idx"
  ON "payment_matches" ("sales_invoice_id");

ALTER TABLE "payment_matches"
  ADD CONSTRAINT "payment_matches_one_invoice_only"
  CHECK (
    ("supplier_invoice_id" IS NOT NULL AND "sales_invoice_id" IS NULL)
    OR ("supplier_invoice_id" IS NULL AND "sales_invoice_id" IS NOT NULL)
  );
