-- Add a system-generated, tenant-unique reference number to supplier invoices.
-- Existing `invoice_number` continues to hold the supplier's printed number;
-- `reference_number` is the canonical system identifier going forward.
--
-- The tenant counter is incremented atomically when a new invoice is inserted.

ALTER TABLE "tenants" ADD COLUMN "supplier_invoice_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "reference_number" varchar(32);--> statement-breakpoint

-- Backfill existing rows: per tenant, assign sequential IB-NNNNNN ordered by
-- created_at. The IB- prefix is chosen so the format is unlikely to collide
-- with any historic value users may have typed into invoice_number.
WITH ranked AS (
  SELECT id, tenant_id,
    row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS seq
  FROM supplier_invoices
)
UPDATE supplier_invoices si
SET reference_number = 'IB-' || lpad(ranked.seq::text, 6, '0')
FROM ranked
WHERE si.id = ranked.id;--> statement-breakpoint

-- Initialise each tenant's counter to its current invoice count so the next
-- generated reference picks up where the backfill left off.
UPDATE tenants t
SET supplier_invoice_counter = COALESCE(
  (SELECT COUNT(*)::int FROM supplier_invoices si WHERE si.tenant_id = t.id),
  0
);--> statement-breakpoint

ALTER TABLE "supplier_invoices" ALTER COLUMN "reference_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_tenant_reference_number_unique" ON "supplier_invoices" USING btree ("tenant_id","reference_number");
