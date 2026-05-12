ALTER TYPE "public"."supplier_invoice_status" ADD VALUE IF NOT EXISTS 'posted';--> statement-breakpoint
ALTER TYPE "public"."supplier_invoice_status" ADD VALUE IF NOT EXISTS 'receiving';--> statement-breakpoint
ALTER TYPE "public"."supplier_invoice_status" ADD VALUE IF NOT EXISTS 'reconciled';
