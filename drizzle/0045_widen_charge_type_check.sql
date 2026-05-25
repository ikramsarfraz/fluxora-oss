-- Widen supplier_invoice_charges.charge_type CHECK to cover the four
-- meat-specific categories the AI extractor was already classifying but
-- the UI dropdown + DB constraint refused: processing (cut/kill/fabrication
-- fees), inspection (USDA / FSIS), cod (COD handling), refrigeration
-- (cold-chain / ice). Without this, any AI-categorized fee in these
-- buckets fell through to "other" — or worse, made it to submit and got
-- rejected by the CHECK constraint at the DB layer.
--
-- Drop-and-recreate the constraint rather than ALTER ADD CHECK — Postgres
-- doesn't have ALTER CHECK CONSTRAINT and dropping the old one is the
-- documented path.

ALTER TABLE "supplier_invoice_charges"
  DROP CONSTRAINT IF EXISTS "supplier_invoice_charges_charge_type_check";--> statement-breakpoint

ALTER TABLE "supplier_invoice_charges"
  ADD CONSTRAINT "supplier_invoice_charges_charge_type_check"
  CHECK ("charge_type" IN ('freight','fuel','tax','discount','processing','inspection','cod','refrigeration','other'));
