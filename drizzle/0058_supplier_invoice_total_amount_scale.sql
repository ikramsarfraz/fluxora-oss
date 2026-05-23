-- Align `supplier_invoices.total_amount` precision with `amount_paid`
-- (both at scale 2 — cents). Previously total_amount was scale 4, which
-- meant a bill totalling $100.0001 could not be exactly matched by a
-- $100.00 payment — and the bill-completion check's 1¢ tolerance
-- (recordSupplierInvoicePayment in supplier-invoices/services/receiving.ts)
-- silently flipped such bills to "paid". The scale-4 was a legacy from
-- when a few line-level surcharge calcs used fractional cents; those
-- now round at write time, so the persisted total is always a whole
-- cents value and the extra precision was unused.
--
-- Postgres rounds existing scale-4 values to scale-2 on ALTER COLUMN
-- TYPE; no manual UPDATE backfill needed.

ALTER TABLE "supplier_invoices"
  ALTER COLUMN "total_amount" TYPE numeric(12, 2);
