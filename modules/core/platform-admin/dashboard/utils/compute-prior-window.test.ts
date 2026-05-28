import assert from "node:assert/strict";
import { test } from "node:test";

import { computePriorWindow } from "./compute-prior-window";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Bounded windows (until is set)
// ---------------------------------------------------------------------------

test("7-day bounded window: prior is 7 days back, ends 1ms before current.since", () => {
  const since = new Date("2026-05-08T00:00:00.000Z");
  const until = new Date("2026-05-14T23:59:59.999Z");
  // windowMs spans (until - since) — not exactly 7 days because `until`
  // is the end-of-day on day 7, but the same offset applies to the
  // prior window so the comparison stays apples-to-apples.

  const prior = computePriorWindow({ since, until });

  assert.equal(
    prior.until.toISOString(),
    "2026-05-07T23:59:59.999Z",
    "prior.until should be 1ms before current.since",
  );
  // The prior window's length should equal the current window's length.
  const currentMs = until.getTime() - since.getTime();
  const priorMs = prior.until.getTime() - prior.since.getTime();
  assert.equal(priorMs, currentMs, "prior length must equal current length");
});

test("calendar-aligned bounded window: prior boundary is exactly 1ms before since", () => {
  const since = new Date("2026-05-01T00:00:00.000Z");
  const until = new Date("2026-05-31T00:00:00.000Z");

  const prior = computePriorWindow({ since, until });

  // priorEnd = since - 1 ms.
  assert.equal(prior.until.getTime(), since.getTime() - 1);
  // priorStart = priorEnd - windowMs.
  const windowMs = until.getTime() - since.getTime();
  assert.equal(prior.since.getTime(), prior.until.getTime() - windowMs);
});

test("same-instant window (since === until): prior is a 0ms window at since-1ms", () => {
  // Edge case — the helper shouldn't blow up on a zero-length range.
  const since = new Date("2026-05-15T12:00:00.000Z");
  const prior = computePriorWindow({ since, until: since });

  assert.equal(prior.until.getTime(), since.getTime() - 1);
  assert.equal(prior.since.getTime(), prior.until.getTime());
});

// ---------------------------------------------------------------------------
// Open-ended windows (until is null/undefined)
// ---------------------------------------------------------------------------

test("open-ended window uses the supplied `now` as the right edge", () => {
  const since = new Date("2026-05-01T00:00:00.000Z");
  const now = new Date("2026-05-28T00:00:00.000Z");
  // windowMs = 27 days

  const prior = computePriorWindow({ since, until: null }, now);

  assert.equal(prior.until.getTime(), since.getTime() - 1);
  const windowMs = now.getTime() - since.getTime();
  const priorMs = prior.until.getTime() - prior.since.getTime();
  assert.equal(priorMs, windowMs, "prior length matches now-anchored current length");
});

test("open-ended window with until omitted entirely behaves the same as until=null", () => {
  const since = new Date("2026-05-01T00:00:00.000Z");
  const now = new Date("2026-05-15T00:00:00.000Z");

  const withUndefined = computePriorWindow({ since }, now);
  const withNull = computePriorWindow({ since, until: null }, now);

  assert.equal(withUndefined.since.getTime(), withNull.since.getTime());
  assert.equal(withUndefined.until.getTime(), withNull.until.getTime());
});

test("open-ended window without an explicit `now` defaults to current time within a tolerance", () => {
  // Can't freeze the clock without extra plumbing — just assert the
  // prior window ends close to "right before since" and is sized to
  // (real now − since) within a small jitter.
  const since = new Date(Date.now() - 10 * ONE_DAY_MS);
  const before = Date.now();
  const prior = computePriorWindow({ since });
  const after = Date.now();

  assert.equal(prior.until.getTime(), since.getTime() - 1);
  // window length should be (≈now − since); allow a few ms of jitter.
  const expectedLengthMin = before - since.getTime();
  const expectedLengthMax = after - since.getTime();
  const priorLength = prior.until.getTime() - prior.since.getTime();
  assert.ok(
    priorLength >= expectedLengthMin && priorLength <= expectedLengthMax,
    `priorLength ${priorLength} should be within [${expectedLengthMin}, ${expectedLengthMax}]`,
  );
});

// ---------------------------------------------------------------------------
// Length parity — the key property the dashboard depends on
// ---------------------------------------------------------------------------

test("prior window length always equals current window length (parametric)", () => {
  const fixedNow = new Date("2026-05-28T00:00:00.000Z");
  const cases: Array<{
    since: Date;
    until: Date | null;
    label: string;
  }> = [
    {
      since: new Date("2026-05-21T00:00:00.000Z"),
      until: new Date("2026-05-28T00:00:00.000Z"),
      label: "rolling 7 days",
    },
    {
      since: new Date("2026-04-28T00:00:00.000Z"),
      until: new Date("2026-05-28T00:00:00.000Z"),
      label: "rolling 30 days",
    },
    {
      since: new Date("2026-05-01T00:00:00.000Z"),
      until: null,
      label: "calendar month, open-ended",
    },
    {
      since: new Date("2026-05-28T00:00:00.000Z"),
      until: new Date("2026-05-28T01:00:00.000Z"),
      label: "1 hour",
    },
  ];

  for (const c of cases) {
    const current = { since: c.since, until: c.until };
    const prior = computePriorWindow(current, fixedNow);
    const currentEnd = c.until ?? fixedNow;
    const currentLength = currentEnd.getTime() - c.since.getTime();
    const priorLength = prior.until.getTime() - prior.since.getTime();
    assert.equal(
      priorLength,
      currentLength,
      `length mismatch for case: ${c.label}`,
    );
    assert.equal(
      prior.until.getTime(),
      c.since.getTime() - 1,
      `prior.until should be exactly since-1ms for case: ${c.label}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Non-overlap guarantee — current and prior must never share an instant
// ---------------------------------------------------------------------------

test("current and prior windows never overlap (the 1ms gap is intentional)", () => {
  const since = new Date("2026-05-21T00:00:00.000Z");
  const until = new Date("2026-05-28T00:00:00.000Z");
  const prior = computePriorWindow({ since, until });

  // prior.until is strictly before current.since so a row at exactly
  // current.since would be counted in current, not prior — and a row
  // at prior.until is in prior, not current.
  assert.ok(prior.until.getTime() < since.getTime());
});
