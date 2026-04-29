--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "first_name" text;

--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_name" text;

--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "full_name" text;

--> statement-breakpoint
UPDATE "user" SET "full_name" = trim(coalesce("name", ''));

--> statement-breakpoint
UPDATE "user"
SET
  "first_name" = CASE
    WHEN trim("full_name") ~ ' ' THEN split_part(trim("full_name"), ' ', 1)
    ELSE NULLIF(trim("full_name"), '')
  END,
  "last_name" = CASE
    WHEN trim("full_name") ~ ' '
      THEN trim(substring(trim("full_name") FROM position(' ' IN trim("full_name")) + 1))
    ELSE ''
  END;

--> statement-breakpoint
UPDATE "user" SET "name" = trim("full_name") WHERE trim("full_name") <> '';

--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "full_name" SET DEFAULT '';

--> statement-breakpoint
UPDATE "user" SET "full_name" = '' WHERE "full_name" IS NULL;

--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "full_name" SET NOT NULL;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signup_profile_pending" (
  "email_lower" varchar(320) PRIMARY KEY,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "full_name" text NOT NULL,
  "expires_at" timestamptz NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signup_profile_pending_expires_at_idx"
  ON "signup_profile_pending" USING btree ("expires_at");
