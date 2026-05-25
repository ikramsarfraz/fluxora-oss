import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveLockState,
  type ClaimOutcome,
} from "./bulk-import-file-lock-state";

// The hook's React wiring (useEffect/heartbeat/release on unmount) needs
// a DOM + timers to test in isolation, which isn't worth setting up here.
// What MUST stay correct is the surface state the banner reads each
// render — anything wrong here causes either a stuck banner or a missed
// foreign-lock signal. The pure helper makes the table of cases
// trivially testable.

describe("deriveLockState", () => {
  it("returns idle when no key is set (queue empty)", () => {
    assert.deepEqual(deriveLockState(null, null), { kind: "idle" });
  });

  it("returns idle even if a stale outcome is cached, when key is null", () => {
    // Edge case: user navigates from a locked row to an empty queue.
    // The cached outcome must not bleed into the empty-queue render.
    const stale: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: { kind: "owned" },
    };
    assert.deepEqual(deriveLockState(null, stale), { kind: "idle" });
  });

  it("returns claiming when key is set but no outcome has landed yet", () => {
    assert.deepEqual(deriveLockState("row-A", null), { kind: "claiming" });
  });

  it("returns claiming when the cached outcome belongs to a different key", () => {
    // Reviewer navigated from row-A to row-B before the row-B claim
    // settled. We must not show row-A's outcome under row-B's banner.
    const previous: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: { kind: "owned" },
    };
    assert.deepEqual(deriveLockState("row-B", previous), {
      kind: "claiming",
    });
  });

  it("returns owned when the cached outcome matches the current key", () => {
    const outcome: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: { kind: "owned" },
    };
    assert.deepEqual(deriveLockState("row-A", outcome), { kind: "owned" });
  });

  it("returns foreign with the holder's name when refused by another reviewer", () => {
    const claimedAt = new Date("2026-05-18T12:00:00Z");
    const outcome: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: {
        kind: "foreign",
        claimedByUserId: "user-sarah",
        claimedByDisplayName: "Sarah Park",
        claimedAt,
      },
    };
    assert.deepEqual(deriveLockState("row-A", outcome), {
      kind: "foreign",
      claimedByUserId: "user-sarah",
      claimedByDisplayName: "Sarah Park",
      claimedAt,
    });
  });

  it("returns unavailable when the row was reviewed out from under us", () => {
    const outcome: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: { kind: "unavailable", reason: "already_reviewed" },
    };
    assert.deepEqual(deriveLockState("row-A", outcome), {
      kind: "unavailable",
      reason: "already_reviewed",
    });
  });

  it("returns unavailable when the row was deleted while we held the banner open", () => {
    const outcome: { key: string; result: ClaimOutcome } = {
      key: "row-A",
      result: { kind: "unavailable", reason: "not_found" },
    };
    assert.deepEqual(deriveLockState("row-A", outcome), {
      kind: "unavailable",
      reason: "not_found",
    });
  });

  it("falls back to claiming when retry resets the cached outcome to null", () => {
    // After a Retry click the hook sets lastOutcome to null AND bumps
    // the retryToken to re-fire the effect. Between that setState and
    // the new server response, the derived state should read "claiming"
    // so the foreign banner clears visually.
    assert.deepEqual(deriveLockState("row-A", null), { kind: "claiming" });
  });
});
