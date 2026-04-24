ALTER TABLE "session"
  ADD COLUMN "workspace_id" text;

CREATE INDEX "session_workspaceId_idx"
  ON "session" ("workspace_id");
