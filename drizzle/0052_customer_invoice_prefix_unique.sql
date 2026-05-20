-- Enforce that an invoice prefix is unique per tenant.
--
-- Without this, two customers in the same tenant can share a prefix
-- (say "ACME"), and any invoice rendered as "ACME-INV-000123" is
-- ambiguous as to which customer it belongs to. The prefix exists
-- precisely to disambiguate, so it should be unique.
--
-- Partial index: `invoice_prefix` is nullable (customers don't have
-- to set one), and NULL values are not considered duplicates by the
-- WHERE clause. Existing rows with NULL stay valid; only set prefixes
-- need to be distinct.
--
-- If this migration fails with a duplicate-key error on existing
-- data, the tenant has real prefix collisions that need to be
-- resolved manually before re-running.

CREATE UNIQUE INDEX "customers_tenant_invoice_prefix_unique"
  ON "customers" ("tenant_id", "invoice_prefix")
  WHERE "invoice_prefix" IS NOT NULL;
