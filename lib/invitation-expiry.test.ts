import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INVITATION_EXPIRY_DAYS_DEFAULT,
  INVITATION_EXPIRY_DAYS_MAX,
  INVITATION_EXPIRY_DAYS_MIN,
  invitationExpiryAt,
  resolveInvitationExpiryDays,
} from "./invitation-expiry";

// ---------------------------------------------------------------------------
// resolveInvitationExpiryDays — defaulting + clamping
// ---------------------------------------------------------------------------

test("resolveInvitationExpiryDays: null falls back to the default", () => {
  assert.equal(resolveInvitationExpiryDays(null), INVITATION_EXPIRY_DAYS_DEFAULT);
  assert.equal(
    resolveInvitationExpiryDays(undefined),
    INVITATION_EXPIRY_DAYS_DEFAULT,
  );
});

test("resolveInvitationExpiryDays: a value inside the range passes through", () => {
  assert.equal(resolveInvitationExpiryDays(14), 14);
});

test("resolveInvitationExpiryDays: floors fractional values", () => {
  // 7.9 → 7. Truncation, not rounding — a "0.9 day" rounding-up would
  // confuse a tenant who set "7" and saw an 8-day window in practice.
  assert.equal(resolveInvitationExpiryDays(7.9), 7);
});

test("resolveInvitationExpiryDays: clamps below MIN", () => {
  assert.equal(resolveInvitationExpiryDays(0), INVITATION_EXPIRY_DAYS_MIN);
  assert.equal(resolveInvitationExpiryDays(-5), INVITATION_EXPIRY_DAYS_MIN);
});

test("resolveInvitationExpiryDays: clamps above MAX", () => {
  assert.equal(resolveInvitationExpiryDays(31), INVITATION_EXPIRY_DAYS_MAX);
  assert.equal(resolveInvitationExpiryDays(9999), INVITATION_EXPIRY_DAYS_MAX);
});

test("resolveInvitationExpiryDays: rejects NaN + Infinity to the default", () => {
  // Direct-DB writes shouldn't be able to inject `Infinity` and bypass
  // the cap; same for NaN sneaking through a borked update path.
  assert.equal(
    resolveInvitationExpiryDays(Number.NaN),
    INVITATION_EXPIRY_DAYS_DEFAULT,
  );
  assert.equal(
    resolveInvitationExpiryDays(Number.POSITIVE_INFINITY),
    INVITATION_EXPIRY_DAYS_DEFAULT,
  );
});

// ---------------------------------------------------------------------------
// invitationExpiryAt — Date math
// ---------------------------------------------------------------------------

test("invitationExpiryAt: with a fixed now + 7-day default", () => {
  const now = new Date("2026-05-27T12:00:00Z");
  const expires = invitationExpiryAt({ configuredDays: null, now });
  assert.equal(expires.toISOString(), "2026-06-03T12:00:00.000Z");
});

test("invitationExpiryAt: configured 14-day window", () => {
  const now = new Date("2026-05-01T00:00:00Z");
  const expires = invitationExpiryAt({ configuredDays: 14, now });
  assert.equal(expires.toISOString(), "2026-05-15T00:00:00.000Z");
});

test("invitationExpiryAt: clamps an over-max value before computing", () => {
  // 90 days would mean a leaked invite stays live for three months —
  // the clamp short-circuits that even if the column somehow lands
  // past the cap via a future migration.
  const now = new Date("2026-05-01T00:00:00Z");
  const expires = invitationExpiryAt({ configuredDays: 90, now });
  // Should be 30 days, not 90.
  assert.equal(expires.toISOString(), "2026-05-31T00:00:00.000Z");
});

test("invitationExpiryAt: a 1-day configuration produces 24h from now", () => {
  const now = new Date("2026-05-01T12:00:00Z");
  const expires = invitationExpiryAt({ configuredDays: 1, now });
  assert.equal(expires.toISOString(), "2026-05-02T12:00:00.000Z");
});

test("invitationExpiryAt: defaults `now` to current time when omitted", () => {
  // We can't assert exact equality on Date.now()-based math without
  // freezing the clock, but the result should be within a small
  // tolerance of (now + 7 days).
  const expires = invitationExpiryAt({ configuredDays: null });
  const expected = Date.now() + INVITATION_EXPIRY_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(expires.getTime() - expected) < 1_000);
});
