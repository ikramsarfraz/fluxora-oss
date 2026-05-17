-- AI failure discrimination + parse_error persistence.
--
-- Adds a new bulk_import_status enum value 'parse_error' (distinct from the
-- legacy 'errored' value which no code writes) and a nullable jsonb
-- parse_error_codes column on bulk_import_files. Persisting failed parses
-- with this status instead of letting them masquerade as 'parsed' rows is
-- the architectural fix for the multipage 0-lines bug class: when AI calls
-- drop mid-stream, the row is now distinguishable from a legitimate empty
-- parse, and the queue UI can surface a re-upload affordance.

ALTER TYPE "bulk_import_status" ADD VALUE 'parse_error';--> statement-breakpoint

ALTER TABLE "bulk_import_files" ADD COLUMN "parse_error_codes" jsonb;
