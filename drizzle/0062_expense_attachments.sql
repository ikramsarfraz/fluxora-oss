-- Expense receipt attachments.
--
-- Mirrors the supplier_invoice_attachments + sales_order_attachments pattern:
-- a small pivot table linking an expense row to a generic file row, with the
-- file bytes living in R2 under a tenant-scoped object key
-- (`tenants/<tenant>/expenses/<expense>/<fileId>.<ext>`).
--
-- tenant_id is denormalized so the per-expense listing can be a single
-- (tenant_id, expense_id) index lookup without joining through files.
--
-- file_category enum gains 'expense_attachment' so the shared files row
-- can be filtered by surface in admin / cleanup queries.

ALTER TYPE "public"."file_category" ADD VALUE IF NOT EXISTS 'expense_attachment';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expense_attachments" (
  "expense_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "expense_attachments_pkey" PRIMARY KEY ("expense_id","file_id")
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expense_attachments"
    ADD CONSTRAINT "expense_attachments_expense_id_expenses_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expense_attachments"
    ADD CONSTRAINT "expense_attachments_file_id_files_id_fk"
    FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "expense_attachments"
    ADD CONSTRAINT "expense_attachments_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expense_attachments_tenant_expense_idx"
  ON "expense_attachments" USING btree ("tenant_id","expense_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "expense_attachments_file_id_idx"
  ON "expense_attachments" USING btree ("file_id");
