-- Add sales_order_attachment value to file_category enum
ALTER TYPE "file_category" ADD VALUE 'sales_order_attachment';
--> statement-breakpoint

-- Sales order attachments join table (mirrors supplier_invoice_attachments)
CREATE TABLE IF NOT EXISTS "sales_order_attachments" (
  "sales_order_id" uuid NOT NULL REFERENCES "sales_orders"("id") ON DELETE CASCADE,
  "file_id"        uuid NOT NULL REFERENCES "files"("id")         ON DELETE CASCADE,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "sales_order_attachments_pkey" PRIMARY KEY("sales_order_id", "file_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sales_order_attachments_file_id_idx"
  ON "sales_order_attachments" ("file_id");
