import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planRecurringInstances } from "./metadata";

describe("planRecurringInstances", () => {
  it("returns nothing when interval is none", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "none",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-05-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, []);
    assert.equal(result.exhausted, false);
  });

  it("returns nothing when recurrenceNextDueDate is null", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: null,
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, []);
    assert.equal(result.exhausted, false);
    assert.equal(result.nextDueDate, null);
  });

  it("returns nothing when next due is after today", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-09-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, []);
    assert.equal(result.nextDueDate, "2026-09-01");
    assert.equal(result.exhausted, false);
  });

  it("materializes one instance when next due equals today", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-08-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, ["2026-08-01"]);
    assert.equal(result.nextDueDate, "2026-09-01");
    assert.equal(result.exhausted, false);
  });

  it("materializes catch-up instances when monthly schedule is months behind", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-05-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, [
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
    assert.equal(result.nextDueDate, "2026-09-01");
    assert.equal(result.exhausted, false);
  });

  it("materializes weekly instances respecting the safety cap", () => {
    // 8 weeks of catch-up but cap is 3 — only 3 instances created,
    // next due advances 3 weeks forward (not all the way to today).
    const result = planRecurringInstances(
      {
        recurrenceInterval: "weekly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-06-01",
      },
      { today: "2026-08-01", cap: 3 },
    );
    assert.equal(result.dueDates.length, 3);
    assert.deepEqual(result.dueDates, [
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
    ]);
    assert.equal(result.nextDueDate, "2026-06-22");
    assert.equal(result.exhausted, false);
  });

  it("stops at end date and marks the schedule exhausted", () => {
    // Monthly schedule from 2026-05-01, ends 2026-07-15. Today is 2026-08-01.
    // Should materialize May, Jun, Jul (Jul-01 ≤ end-date 07-15). The next
    // candidate would be 2026-08-01, which is > end-date → exhausted, nextDue null.
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: "2026-07-15",
        recurrenceNextDueDate: "2026-05-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, [
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
    assert.equal(result.nextDueDate, null);
    assert.equal(result.exhausted, true);
  });

  it("treats nextDue exactly on end date as the final instance", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "weekly",
        recurrenceEndDate: "2026-08-01",
        recurrenceNextDueDate: "2026-08-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, ["2026-08-01"]);
    assert.equal(result.nextDueDate, null);
    assert.equal(result.exhausted, true);
  });

  it("returns no instances and is not exhausted when nextDue is after end date already", () => {
    // Defensive: end date earlier than next due (data drift). Should produce
    // zero instances and park the schedule as exhausted.
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: "2026-04-01",
        recurrenceNextDueDate: "2026-05-01",
      },
      { today: "2026-08-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, []);
    assert.equal(result.nextDueDate, null);
    assert.equal(result.exhausted, true);
  });

  it("clamps month-end then drifts (Jan 31 → Feb 28 → Mar 28 …)", () => {
    // Documenting actual behavior: nextRecurrenceDate chains from each
    // materialized date, so a "monthly on the 31st" schedule that hits Feb
    // clamps to Feb 28 and stays on the 28th forever after — the original
    // 31st intent is not preserved. Acceptable for v1; tracked behavior.
    const result = planRecurringInstances(
      {
        recurrenceInterval: "monthly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-01-31",
      },
      { today: "2026-04-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, [
      "2026-01-31",
      "2026-02-28",
      "2026-03-28",
    ]);
    assert.equal(result.nextDueDate, "2026-04-28");
  });

  it("quarterly schedule advances 3 months at a time", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "quarterly",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2026-01-15",
      },
      { today: "2026-10-01", cap: 36 },
    );
    assert.deepEqual(result.dueDates, [
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
    ]);
    assert.equal(result.nextDueDate, "2026-10-15");
  });

  it("annual schedule with cap=1 only materializes one instance per run", () => {
    const result = planRecurringInstances(
      {
        recurrenceInterval: "annually",
        recurrenceEndDate: null,
        recurrenceNextDueDate: "2024-03-01",
      },
      { today: "2026-08-01", cap: 1 },
    );
    assert.deepEqual(result.dueDates, ["2024-03-01"]);
    assert.equal(result.nextDueDate, "2025-03-01");
    assert.equal(result.exhausted, false);
  });
});
