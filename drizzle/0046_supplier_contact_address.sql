-- Add contact info, US remit-to address, tax ID, account number, website,
-- and free-text notes to suppliers. All columns nullable: additive change,
-- no backfill required for existing rows.
--
-- Country intentionally omitted — product is US-only for v1. A future
-- migration can add `address_country` with default 'US' if needed.

ALTER TABLE "suppliers"
  ADD COLUMN "primary_contact_name" varchar(255),
  ADD COLUMN "primary_contact_email" varchar(320),
  ADD COLUMN "primary_contact_phone" varchar(32),
  ADD COLUMN "tax_id" varchar(64),
  ADD COLUMN "account_number" varchar(64),
  ADD COLUMN "address_line1" varchar(255),
  ADD COLUMN "address_line2" varchar(255),
  ADD COLUMN "address_city" varchar(128),
  ADD COLUMN "address_region" varchar(128),
  ADD COLUMN "address_postal_code" varchar(32),
  ADD COLUMN "website_url" varchar(512),
  ADD COLUMN "notes" text;
