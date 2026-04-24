DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'tenant_type'
  ) THEN
    CREATE TYPE "tenant_type" AS ENUM ('solo', 'business');
  END IF;
END $$;

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "tenant_type" "tenant_type";

UPDATE "tenants"
SET "tenant_type" = COALESCE("tenant_type", 'business'::tenant_type);

ALTER TABLE "tenants"
  ALTER COLUMN "tenant_type" SET DEFAULT 'business',
  ALTER COLUMN "tenant_type" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'session'
      AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE "session" RENAME COLUMN "workspace_id" TO "tenant_id";
  END IF;
END $$;

ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "tenant_id" text;

DROP INDEX IF EXISTS "session_workspaceId_idx";
CREATE INDEX IF NOT EXISTS "session_tenantId_idx"
  ON "session" ("tenant_id");
