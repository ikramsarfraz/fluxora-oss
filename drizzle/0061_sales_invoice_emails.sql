-- AR-side counterpart to bill_forwards. Tracks every outbound send of
-- a customer-facing sales invoice — recipients, message, whether the
-- rendered PDF was attached, and (forward-looking) the Resend message
-- id so a webhook handler can update delivery_status later.
--
-- Also adds last_sent_at + send_count to sales_invoices so the detail
-- page can render a "Last sent …" badge without aggregating the audit
-- table. Both columns are backfill-safe (nullable / default 0).

DO $$ BEGIN
  CREATE TYPE "sales_invoice_email_delivery_status" AS ENUM ('sent', 'bounced', 'delivered');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "last_sent_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "send_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sales_invoice_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "sales_invoice_id" uuid NOT NULL,
  "sent_by_user_id" uuid,
  "recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "cc_recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "subject" text NOT NULL,
  "message_body" text NOT NULL,
  "attached_pdf" boolean NOT NULL DEFAULT true,
  "delivery_status" "sales_invoice_email_delivery_status" NOT NULL DEFAULT 'sent',
  "delivery_events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "resend_message_id" text,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sales_invoice_emails"
    ADD CONSTRAINT "sales_invoice_emails_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sales_invoice_emails"
    ADD CONSTRAINT "sales_invoice_emails_sales_invoice_id_sales_invoices_id_fk"
    FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sales_invoice_emails"
    ADD CONSTRAINT "sales_invoice_emails_sent_by_user_id_portal_users_id_fk"
    FOREIGN KEY ("sent_by_user_id") REFERENCES "portal_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sales_invoice_emails_tenant_id_idx"
  ON "sales_invoice_emails" USING btree ("tenant_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sales_invoice_emails_invoice_id_idx"
  ON "sales_invoice_emails" USING btree ("sales_invoice_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sales_invoice_emails_resend_message_id_idx"
  ON "sales_invoice_emails" USING btree ("resend_message_id")
  WHERE "resend_message_id" IS NOT NULL;
