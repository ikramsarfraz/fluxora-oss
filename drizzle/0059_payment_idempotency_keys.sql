-- Payment dedup via client-generated idempotency keys.
--
-- Each payment-submit form generates a UUID at form-instance time and
-- passes it through to the service. The service INSERTs the row with
-- that key; the partial unique index here guarantees a second submit
-- (double-click, fetch retry) raises 23505 and the service translates
-- that to "return the existing payment's invoice state" instead of
-- creating a duplicate payment.
--
-- Nullable + partial: legacy rows pre-this-migration carry NULL keys
-- and don't participate in the dedup. Server-internal paths that
-- don't need dedup (e.g. background imports) can also leave the
-- column NULL.
--
-- Scoped per tenant so the tenant boundary is preserved at the
-- index level — though UUIDv4 collisions across tenants are already
-- statistically impossible.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "idempotency_key" uuid;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payments_tenant_idempotency_key_unique"
  ON "payments" USING btree ("tenant_id","idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "supplier_invoice_payments"
  ADD COLUMN IF NOT EXISTS "idempotency_key" uuid;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_payments_tenant_idempotency_key_unique"
  ON "supplier_invoice_payments" USING btree ("tenant_id","idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
