import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canTransition,
  expenseStatusLabel,
  expenseStatusTone,
  nextStatus,
  type ExpenseStatus,
} from "./expense-status";

describe("canTransition", () => {
  const cases: Array<{
    from: ExpenseStatus;
    transition: Parameters<typeof canTransition>[1];
    expected: boolean;
  }> = [
    // Legal moves
    { from: "draft", transition: "submit", expected: true },
    { from: "submitted", transition: "approve", expected: true },
    { from: "submitted", transition: "reject", expected: true },
    { from: "rejected", transition: "reset", expected: true },
    { from: "approved", transition: "mark_paid", expected: true },
    // Illegal moves — wrong starting state
    { from: "draft", transition: "approve", expected: false },
    { from: "draft", transition: "reject", expected: false },
    { from: "draft", transition: "reset", expected: false },
    { from: "draft", transition: "mark_paid", expected: false },
    { from: "submitted", transition: "submit", expected: false },
    { from: "submitted", transition: "mark_paid", expected: false },
    { from: "approved", transition: "submit", expected: false },
    { from: "approved", transition: "approve", expected: false },
    { from: "approved", transition: "reject", expected: false },
    { from: "rejected", transition: "submit", expected: false },
    { from: "rejected", transition: "approve", expected: false },
    // 'paid' is terminal
    { from: "paid", transition: "submit", expected: false },
    { from: "paid", transition: "approve", expected: false },
    { from: "paid", transition: "reject", expected: false },
    { from: "paid", transition: "reset", expected: false },
    { from: "paid", transition: "mark_paid", expected: false },
  ];

  for (const c of cases) {
    it(`${c.from} --${c.transition}--> ${c.expected ? "ok" : "rejected"}`, () => {
      assert.equal(canTransition(c.from, c.transition), c.expected);
    });
  }
});

describe("nextStatus", () => {
  it("maps each transition to its target state", () => {
    assert.equal(nextStatus("submit"), "submitted");
    assert.equal(nextStatus("approve"), "approved");
    assert.equal(nextStatus("reject"), "rejected");
    assert.equal(nextStatus("reset"), "draft");
    assert.equal(nextStatus("mark_paid"), "paid");
  });
});

describe("expenseStatusLabel", () => {
  it("returns human labels for known statuses", () => {
    assert.equal(expenseStatusLabel("draft"), "Draft");
    assert.equal(expenseStatusLabel("submitted"), "Submitted");
    assert.equal(expenseStatusLabel("approved"), "Approved");
    assert.equal(expenseStatusLabel("rejected"), "Rejected");
    assert.equal(expenseStatusLabel("paid"), "Paid");
  });

  it("falls back gracefully for null / unknown", () => {
    assert.equal(expenseStatusLabel(null), "Unknown");
    assert.equal(expenseStatusLabel(undefined), "Unknown");
    assert.equal(expenseStatusLabel("bogus"), "bogus");
  });
});

describe("expenseStatusTone", () => {
  it("maps statuses to design-system tones", () => {
    assert.equal(expenseStatusTone("draft"), "neutral");
    assert.equal(expenseStatusTone("submitted"), "info");
    assert.equal(expenseStatusTone("approved"), "success");
    assert.equal(expenseStatusTone("rejected"), "danger");
    assert.equal(expenseStatusTone("paid"), "success");
  });

  it("falls back to neutral for unknown / null", () => {
    assert.equal(expenseStatusTone(null), "neutral");
    assert.equal(expenseStatusTone("bogus"), "neutral");
  });
});
