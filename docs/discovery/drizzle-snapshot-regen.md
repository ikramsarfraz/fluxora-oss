# Regenerating the drizzle/meta snapshot baseline

**Why this exists.** Closes [#287](https://github.com/anthropics/fluxora/issues/287). Eight historical
`drizzle/meta/*_snapshot.json` files (idx 0, 18, 19, 20, 23, 24, 25, 30) lived in
the repo against 71 journal entries (idx 0–70). Every `pnpm db:generate` call diffed
`schema.ts` against the stalest available snapshot (`0030_snapshot.json`), saw
40+ migrations worth of changes, and triggered drizzle-kit's column-rename
disambiguation prompt cascade — which can't be answered non-interactively. PRs
#270, #292, #295, #297 all worked around this by hand-authoring their migration
SQL files.

This document describes how the `0070_snapshot.json` shipped with this PR was
produced, so the next person who needs to bring the baseline forward can
reproduce the procedure cleanly.

## The trick

`drizzle-kit generate` builds two artifacts from the diff between (a) the last
snapshot named in `_journal.json` and (b) the current `schema.ts`:

  - the new migration SQL (`drizzle/<idx>_<tag>.sql`)
  - the new snapshot (`drizzle/meta/<idx>_snapshot.json`)

If we trick drizzle into thinking there's **no previous snapshot** (empty
journal, empty meta directory), step (a) becomes "create everything from
nothing" and the generated snapshot reflects `schema.ts` **exactly** — using
drizzle-kit's own naming conventions, ordering, and shape. Discarding the
emitted SQL and keeping the snapshot gives us a clean baseline that
`db:generate` will diff against without spurious renames.

A `drizzle-kit pull` against a live DB *also* produces a snapshot, but it
records the database's actual constraint names — which may differ from what
drizzle-kit would generate from `schema.ts` (older migrations created
constraints with names that no longer match the current naming convention). A
pull-derived snapshot will then make `db:generate` think it needs to drop and
re-add every check + foreign-key constraint in the schema. Synthesizing from
`schema.ts` avoids that whole class of false-positive diff.

## Procedure

Run from the repo root. None of these steps touch any DB; all reads are local
files and the only writes are inside `drizzle/`.

1. **Back up** the live state:
   ```sh
   cp drizzle/meta/_journal.json /tmp/journal-backup.json
   mkdir -p /tmp/meta-backup && cp drizzle/meta/0*_snapshot.json /tmp/meta-backup/
   ```

2. **Empty** the journal + meta directory:
   ```sh
   rm drizzle/meta/0*_snapshot.json
   echo '{"version":"7","dialect":"postgresql","entries":[]}' > drizzle/meta/_journal.json
   ```

3. **Generate** — drizzle-kit thinks the DB is empty and writes a create-everything
   migration + a `0000_snapshot.json` derived from `schema.ts`:
   ```sh
   pnpm drizzle-kit generate --dialect=postgresql --schema=./db/schema.ts --out=./drizzle
   ```

4. **Save** the synthesized snapshot, restore the originals, install the
   snapshot at the latest journal idx:
   ```sh
   cp drizzle/meta/0000_snapshot.json /tmp/synthesized.json
   cp /tmp/journal-backup.json drizzle/meta/_journal.json
   cp /tmp/meta-backup/*.json drizzle/meta/
   rm drizzle/meta/0000_snapshot.json drizzle/<idx>_<auto-name>.sql
   cp /tmp/synthesized.json drizzle/meta/<latest-idx>_snapshot.json
   ```
   Replace `<latest-idx>` with the `idx` of the last entry in `_journal.json`,
   zero-padded to 4 digits (e.g. `0070`).

5. **Link the chain.** The synthesized snapshot has `prevId:
   "00000000-0000-0000-0000-000000000000"` because it was generated against an
   empty journal. Drizzle-kit refuses to load two root snapshots in the same
   chain — patch `prevId` to point at the previous existing snapshot's `id`
   (in this PR, `drizzle/meta/0030_snapshot.json`):
   ```sh
   PREV_ID=$(jq -r '.id' drizzle/meta/0030_snapshot.json)
   jq ".prevId = \"$PREV_ID\"" drizzle/meta/0070_snapshot.json > /tmp/x.json && mv /tmp/x.json drizzle/meta/0070_snapshot.json
   ```

6. **Verify** — generate without a config-driven DB URL (the command is a pure
   local diff and doesn't need a live DB):
   ```sh
   pnpm drizzle-kit generate --dialect=postgresql --schema=./db/schema.ts --out=./drizzle
   ```
   Expected output: `No schema changes, nothing to migrate 😴`.

   If it emits a SQL file, the diff is real — inspect, decide whether the
   discrepancy is intentional (a new schema change you wanted to ship) or
   indicates the synthesis missed something.

## Why intermediate snapshots aren't restored

`drizzle-kit generate` only reads the snapshot whose idx matches the last entry
in `_journal.json`. The other snapshots in `drizzle/meta/` exist for
historical-replay tooling (`drizzle-kit drop`, `migrate-state` diagnostics) and
the 8 stale ones already present in this repo don't actively harm anything.
Backfilling intermediate snapshots cumulatively (apply migrations 1..N, pull,
save as `<N>_snapshot.json`) would require a working `drizzle-kit pull` against
each historical schema state, which is its own significant chore.

When this baseline drifts again (after enough future migrations), repeat the
procedure with a higher `<latest-idx>`.

## What this PR doesn't fix

The migrator's all-at-once batch behaviour: `drizzle-orm/node-postgres/migrator`
applies migrations such that an `ALTER TYPE … ADD VALUE` and a subsequent use
of that value in another migration end up in the same outer transaction —
which Postgres rejects. This bit a fresh-DB attempt to bring the container up
to the current schema during snapshot regeneration; a per-connection loop
worked around it. If someone wants to `pnpm db:reset && pnpm db:migrate` cleanly,
a `db:apply-individually` script that opens a new connection per migration
would solve it. Out of scope here.
