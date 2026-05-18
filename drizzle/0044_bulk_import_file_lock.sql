-- Advisory claim on bulk_import_files so two reviewers don't race on the
-- same queue row. Whoever opens the Review screen first holds the claim;
-- a second viewer sees a banner ("Alice is reviewing this file") and the
-- Complete button is gated. The claim auto-expires after a heartbeat
-- timeout so a closed tab doesn't strand the row forever.
--
-- Strictly advisory — the existing `status = 'parsed'` WHERE filter on
-- markBulkImportFileReviewed already prevents two posts from racing. The
-- claim's job is UX (don't let both reviewers waste effort) not data
-- integrity.

ALTER TABLE "bulk_import_files"
  ADD COLUMN "claimed_by_user_id" uuid REFERENCES "portal_users" ("id") ON DELETE SET NULL,
  ADD COLUMN "claimed_at" timestamptz;
