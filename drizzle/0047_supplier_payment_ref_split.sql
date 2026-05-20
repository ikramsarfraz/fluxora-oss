-- Split `supplier_invoice_payments.reference` into separate `check_number`
-- and `reference_number` columns to mirror the AR `payments` table. The
-- single column used to do double duty — the UI relabelled "Reference"
-- as "Check number" when method was check — losing the semantic
-- distinction in storage. Accounting exports want them apart.
--
-- Migration is data-preserving: backfill old `reference` values into the
-- column that matches the payment method, then drop the legacy column.

ALTER TABLE "supplier_invoice_payments"
  ADD COLUMN "check_number" varchar(64),
  ADD COLUMN "reference_number" varchar(128);

-- Check-method payments → check_number; everything else → reference_number.
UPDATE "supplier_invoice_payments"
  SET "check_number" = "reference"
  WHERE "payment_method" = 'check' AND "reference" IS NOT NULL;

UPDATE "supplier_invoice_payments"
  SET "reference_number" = "reference"
  WHERE "payment_method" != 'check' AND "reference" IS NOT NULL;

ALTER TABLE "supplier_invoice_payments" DROP COLUMN "reference";
