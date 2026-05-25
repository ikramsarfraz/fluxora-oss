-- Add billing / contact fields to customers:
--   email     — primary contact / invoice delivery channel (nullable, not unique:
--               same person can be on multiple customer records, e.g. franchisees).
--   tax_id    — US EIN or equivalent identifier on invoices (nullable).
--   net_days  — AR payment terms (net N days). Null means no terms configured;
--               AR aging falls back to invoice date (Net-0), matching how
--               suppliers.net_days behaves on the AP side.
--
-- All additive; no backfill required for existing rows.

ALTER TABLE "customers"
  ADD COLUMN "email" varchar(320),
  ADD COLUMN "tax_id" varchar(64),
  ADD COLUMN "net_days" integer;

CREATE INDEX "customers_tenant_email_idx"
  ON "customers" ("tenant_id", "email");
