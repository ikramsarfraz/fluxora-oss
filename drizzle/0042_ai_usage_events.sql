-- AI usage events: one row per OpenAI call made during invoice parsing.
-- Drives platform-admin cost transparency (per-tenant token usage, escalation
-- frequency, monthly cost trajectory). See schema.ts comment for rationale.

CREATE TYPE "ai_usage_stage" AS ENUM (
  'invoice_extraction',
  'vision_extraction',
  'product_matching'
);--> statement-breakpoint

CREATE TABLE "ai_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "portal_user_id" uuid REFERENCES "portal_users" ("id") ON DELETE SET NULL,
  "stage" "ai_usage_stage" NOT NULL,
  "model" varchar(64) NOT NULL,
  "escalated_from_model" varchar(64),
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "cost_micros" integer DEFAULT 0 NOT NULL,
  "succeeded" boolean NOT NULL,
  "error_code" varchar(32),
  "source_bulk_import_file_id" uuid REFERENCES "bulk_import_files" ("id") ON DELETE SET NULL,
  "source_filename" varchar(512),
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "ai_usage_events_tenant_created_at_idx" ON "ai_usage_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_escalated_idx" ON "ai_usage_events" USING btree ("escalated_from_model");--> statement-breakpoint
CREATE INDEX "ai_usage_events_source_bulk_import_file_idx" ON "ai_usage_events" USING btree ("source_bulk_import_file_id");
