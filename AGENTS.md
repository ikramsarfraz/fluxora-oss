<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:migration-rules -->
# Drizzle migration rules

## The `when` timestamp must be strictly increasing

`drizzle-orm`'s migrator applies a migration only when its `when` value in `_journal.json` is **greater than** the `created_at` of the last row in `__drizzle_migrations`. A migration whose `when` is earlier than any already-applied migration is silently skipped — no error, no warning, the table just never gets created.

**Before committing any new migration entry:**
1. Open `drizzle/meta/_journal.json`.
2. Find the highest `when` value among all existing entries.
3. Set the new entry's `when` to something strictly larger (e.g. `highestWhen + 100000`).

This most commonly breaks when `drizzle-kit generate` is run at a wall-clock time that is earlier than manually-authored entries that were backdated (or when entries are reordered). Always verify the `when` sequence after generating or hand-writing a migration.
<!-- END:migration-rules -->
