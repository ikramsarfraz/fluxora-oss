-- Per-row pdf_content_hash for upload dedup (issue #222).
--
-- Hand-written exception to the "no hand-written SQL" rule, same as 0065
-- and 0068, because `pnpm db:generate` is still blocked on the
-- drizzle/meta/ snapshot drift (#287). Once the snapshots are
-- regenerated, future migrations go through the normal generated flow.
--
-- The column mirrors the schema declaration in db/schema.ts exactly.
-- Nullable (no default) because we're not backfilling — the dedup
-- lookup treats NULL as "no hash recorded, fall through" which is the
-- safe direction. The companion index supports the (tenant_id,
-- pdf_content_hash) lookup the bulk-import service does pre-parse.
-- Index is non-unique: a tenant who deletes a row should be able to
-- re-upload the same PDF, and the read path filters deleted_at IS NULL.

ALTER TABLE "bulk_import_files"
  ADD COLUMN IF NOT EXISTS "pdf_content_hash" varchar(64);

CREATE INDEX IF NOT EXISTS "bulk_import_files_tenant_hash_idx"
  ON "bulk_import_files" ("tenant_id", "pdf_content_hash");
