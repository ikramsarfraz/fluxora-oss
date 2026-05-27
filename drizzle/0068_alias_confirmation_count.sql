-- Per-alias confirmation_count (issue #97).
--
-- Hand-written exception to the "no hand-written SQL" rule, same as 0065,
-- because `pnpm db:generate` is still blocked on the drizzle/meta/
-- snapshot drift (#287). Once the snapshots are regenerated, future
-- migrations go through the normal generated flow.
--
-- The column mirrors the schema declaration in db/schema.ts exactly.
-- Default 1 because every existing alias has been confirmed at least
-- once (the upsert path that created it = a confirmation event).

ALTER TABLE "supplier_product_aliases"
  ADD COLUMN IF NOT EXISTS "confirmation_count" integer NOT NULL DEFAULT 1;
