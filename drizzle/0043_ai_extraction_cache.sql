-- AI extraction cache: skip OpenAI when a tenant re-uploads a PDF we've
-- already parsed. Stores the raw AiExtractionResult JSON keyed on the
-- SHA-256 of the PDF bytes. Cache hits re-run deterministic product
-- matching against the current catalog (so renamed/deleted products don't
-- produce stale references), but bypass the OpenAI call entirely.
--
-- Scope is per-tenant — never share across tenants because the prompt
-- includes that tenant's supplier + product candidates, which influences
-- the AI's choice of supplierName and unmatched-line composition.

CREATE TABLE "ai_extraction_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "pdf_content_hash" varchar(64) NOT NULL,
  "ai_extraction_json" jsonb NOT NULL,
  "stage" "ai_usage_stage" NOT NULL,
  "model" varchar(64) NOT NULL,
  "source_filename" varchar(512),
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "ai_extraction_cache_tenant_hash_stage_unique" ON "ai_extraction_cache" USING btree ("tenant_id","pdf_content_hash","stage");--> statement-breakpoint
CREATE INDEX "ai_extraction_cache_created_at_idx" ON "ai_extraction_cache" USING btree ("created_at");
