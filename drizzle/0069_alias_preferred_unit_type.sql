-- Per-alias preferred_unit_type (issue #223).
--
-- Hand-written exception to the "no hand-written SQL" rule, same as 0065
-- and 0068, because `pnpm db:generate` is still blocked on the
-- drizzle/meta/ snapshot drift (#287). Once the snapshots are
-- regenerated, future migrations go through the normal generated flow.
--
-- The column mirrors the schema declaration in db/schema.ts exactly.
-- Nullable (no default) because NULL is the explicit "user has never
-- overridden the parser's default" signal — the parsing pipeline reads
-- it to bypass the AI's unit-type guess only when the user has actively
-- corrected it on a prior bill for the same (supplier, vendor product
-- name) pair.

ALTER TABLE "supplier_product_aliases"
  ADD COLUMN IF NOT EXISTS "preferred_unit_type" varchar(32);
