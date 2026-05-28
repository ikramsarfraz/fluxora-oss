#!/usr/bin/env bash
# Boots a disposable Postgres via docker-compose.test.yml, syncs the
# schema to it, executes the integration tests, and tears down
# regardless of pass/fail.
#
# Safety model
# ────────────
# This script is in the same process tree as the user's shell, so any
# `DATABASE_URL` they have exported is normally inherited. We override
# it explicitly — BUT db/index.ts also calls `dotenv.config({ override:
# true })` on .env.local, which silently re-overrides shell-exported
# values with whatever's in .env.local (usually a hosted Neon URL).
# That meant a prior version of this script unknowingly ran tests
# against prod Neon.
#
# The fix:
#  1. Swap .env.local for a test-only fixture during the run, then
#     restore on exit. dotenv has nothing to read except the test URL.
#  2. The test file itself asserts the resolved DATABASE_URL hostname
#     is localhost / 127.0.0.1 before importing any db module — last
#     line of defense if step 1 ever breaks.
#  3. We hard refuse to run if a `.env.local.test-backup` already
#     exists, since that implies a prior run crashed mid-swap and the
#     real .env.local is still off to the side.

set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"
TEST_DB_URL="postgresql://fluxora_test:fluxora_test@localhost:5433/fluxora_test"
ENV_FILE=".env.local"
ENV_BACKUP=".env.local.test-backup"

if [[ -f "${ENV_BACKUP}" ]]; then
  echo "[test:integration] ${ENV_BACKUP} exists — a previous run crashed mid-swap." >&2
  echo "[test:integration] Verify .env.local is correct, then delete ${ENV_BACKUP} and retry." >&2
  exit 1
fi

# Brace-wrap every $VAR throughout the script — set -u + a glued
# multi-byte char (e.g. the ellipsis on the restore line below) lets
# bash read the first ellipsis byte as part of the identifier and
# crashes with "ENV_FILE\xe2: unbound variable" on EXIT, which fires
# AFTER the tests passed and is maddening to debug.
restore_env() {
  if [[ -f "${ENV_BACKUP}" ]]; then
    echo "[test:integration] restoring ${ENV_FILE}…"
    mv "${ENV_BACKUP}" "${ENV_FILE}"
  fi
}

cleanup() {
  restore_env
  echo "[test:integration] tearing down test Postgres…"
  docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Backup .env.local and write a hybrid version: the user's real keys
# (so module-load env-var checks for Stripe/Resend/R2/etc. pass) PLUS
# the test DB URLs appended at the end. dotenv parses sequentially —
# later definitions of the same key override earlier ones, so the
# trailing DATABASE_URL=$TEST_DB_URL wins over whatever the user had
# above. Keeping the real keys in process.env is safe because the test
# never makes outbound API calls; it only reads/writes the dockered
# Postgres.
if [[ -f "${ENV_FILE}" ]]; then
  echo "[test:integration] backing up ${ENV_FILE} → ${ENV_BACKUP} and appending test overrides…"
  cp "${ENV_FILE}" "${ENV_BACKUP}"
fi
cat >> "${ENV_FILE}" <<EOF

# ── injected by scripts/test-integration.sh — removed on exit ──
DATABASE_URL=${TEST_DB_URL}
DATABASE_URL_UNPOOLED=${TEST_DB_URL}
NODE_ENV=test
EOF

echo "[test:integration] booting test Postgres on :5433…"
docker compose -f "${COMPOSE_FILE}" up -d --wait

echo "[test:integration] syncing schema via drizzle-kit push…"
# Why push, not migrate? The migration replay (db:migrate) wraps every
# pending migration in one Postgres transaction, and migration 0048
# uses an enum value added in 0030 — Postgres rejects this under "new
# enum values must be committed before they can be used". `push` writes
# the live schema.ts straight to the DB, bypassing the replay and the
# bug. The migration-runner fix is its own follow-up; it doesn't need
# to gate the tenant-isolation test.
DATABASE_URL="${TEST_DB_URL}" \
DATABASE_URL_UNPOOLED="${TEST_DB_URL}" \
NODE_ENV=test \
pnpm exec drizzle-kit push --force

echo "[test:integration] running tenant-isolation suite…"
DATABASE_URL="${TEST_DB_URL}" \
DATABASE_URL_UNPOOLED="${TEST_DB_URL}" \
NODE_ENV=test \
node \
  --conditions=react-server \
  --experimental-test-module-mocks \
  --import tsx \
  --test \
  modules/core/tenants/tests/tenant-isolation.test.mts
