-- bulk_import_files: durable history of PDFs uploaded through the bulk-import
-- flow. Replaces the prior 24h localStorage handoff with a server-backed,
-- cross-device, audit-friendly record. Each row pins the parsed
-- PipelineResult JSON + the R2 object key for the original PDF. PR A2 will
-- migrate the client off localStorage to read this table.

CREATE TYPE "bulk_import_status" AS ENUM ('parsed', 'reviewed', 'errored');--> statement-breakpoint

CREATE TABLE "bulk_import_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "uploaded_by_user_id" uuid REFERENCES "portal_users" ("id") ON DELETE SET NULL,
  "batch_id" uuid NOT NULL,
  "filename" varchar(512) NOT NULL,
  "mime_type" varchar(255),
  "size_bytes" integer,
  "object_key" varchar(1024) NOT NULL,
  "pipeline_result" jsonb,
  "status" "bulk_import_status" DEFAULT 'parsed' NOT NULL,
  "reviewed_at" timestamptz,
  "supplier_invoice_id" uuid REFERENCES "supplier_invoices" ("id") ON DELETE SET NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "bulk_import_files_object_key_unique" ON "bulk_import_files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "bulk_import_files_tenant_status_created_at_idx" ON "bulk_import_files" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bulk_import_files_batch_id_idx" ON "bulk_import_files" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "bulk_import_files_tenant_deleted_at_idx" ON "bulk_import_files" USING btree ("tenant_id","deleted_at");
