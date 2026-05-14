import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expenseRecurrenceLabel,
  nextRecurrenceDate,
} from "./metadata";

describe("expenseRecurrenceLabel", () => {
  it("returns 'Does not repeat' for none/null/undefined", () => {
    assert.equal(expenseRecurrenceLabel(null), "Does not repeat");
    assert.equal(expenseRecurrenceLabel(undefined), "Does not repeat");
    assert.equal(expenseRecurrenceLabel("none"), "Does not repeat");
  });

  it("returns human labels for recognised intervals", () => {
    assert.equal(expenseRecurrenceLabel("weekly"), "Weekly");
    assert.equal(expenseRecurrenceLabel("biweekly"), "Every 2 weeks");
    assert.equal(expenseRecurrenceLabel("monthly"), "Monthly");
    assert.equal(expenseRecurrenceLabel("quarterly"), "Quarterly");
    assert.equal(expenseRecurrenceLabel("annually"), "Annually");
  });
});

describe("nextRecurrenceDate", () => {
  it("returns the same date when interval is 'none'", () => {
    assert.equal(nextRecurrenceDate("2026-05-13", "none"), "2026-05-13");
  });

  it("advances 7 days for weekly", () => {
    assert.equal(nextRecurrenceDate("2026-05-13", "weekly"), "2026-05-20");
  });

  it("advances 14 days for biweekly", () => {
    assert.equal(nextRecurrenceDate("2026-05-13", "biweekly"), "2026-05-27");
  });

  it("advances one calendar month for monthly", () => {
    assert.equal(nextRecurrenceDate("2026-05-13", "monthly"), "2026-06-13");
  });

  it("advances three calendar months for quarterly", () => {
    assert.equal(nextRecurrenceDate("2026-01-15", "quarterly"), "2026-04-15");
  });

  it("advances twelve calendar months for annually", () => {
    assert.equal(nextRecurrenceDate("2025-12-31", "annually"), "2026-12-31");
  });

  it("clamps day-of-month for monthly so Jan 31 + 1 month lands on Feb (non-leap)", () => {
    // 2026 is not a leap year, so Feb 28 is the last day.
    assert.equal(nextRecurrenceDate("2026-01-31", "monthly"), "2026-02-28");
  });

  it("clamps day-of-month for monthly so Jan 31 + 1 month lands on Feb 29 in a leap year", () => {
    assert.equal(nextRecurrenceDate("2024-01-31", "monthly"), "2024-02-29");
  });

  it("rolls year correctly for monthly across December", () => {
    assert.equal(nextRecurrenceDate("2025-12-15", "monthly"), "2026-01-15");
  });

  it("rolls year correctly for quarterly across December", () => {
    assert.equal(nextRecurrenceDate("2025-11-15", "quarterly"), "2026-02-15");
  });
});
