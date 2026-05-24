import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectTransferPairs, type TransferCandidate } from "./transfer-pairing";

function txn(
  partial: Partial<TransferCandidate> & { id: string; amount: number },
): TransferCandidate {
  return {
    bankAccountId: "acct-1",
    date: "2026-05-01",
    isoCurrencyCode: "USD",
    ...partial,
  };
}

// Deterministic id generator for assertions
function makeCounter() {
  let n = 0;
  return () => `pair-${++n}`;
}

describe("detectTransferPairs", () => {
  it("pairs an outflow with its matching inflow", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase", date: "2026-05-10" }),
        txn({ id: "in", amount: -500, bankAccountId: "wells", date: "2026-05-11" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 1);
    assert.deepEqual(pairs[0], { outflowId: "out", inflowId: "in", pairId: "pair-1" });
  });

  it("does not pair across the same bank account", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase" }),
        txn({ id: "in", amount: -500, bankAccountId: "chase" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 0);
  });

  it("does not pair across different currencies", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase", isoCurrencyCode: "USD" }),
        txn({ id: "in", amount: -500, bankAccountId: "wells", isoCurrencyCode: "EUR" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 0);
  });

  it("tolerates a 1-cent rounding mismatch", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 100.0, bankAccountId: "chase" }),
        txn({ id: "in", amount: -99.99, bankAccountId: "wells" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 1);
  });

  it("rejects when amounts differ by more than the epsilon", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 100, bankAccountId: "chase" }),
        txn({ id: "in", amount: -100.5, bankAccountId: "wells" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 0);
  });

  it("respects the date window (default 3 days)", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase", date: "2026-05-01" }),
        txn({ id: "in", amount: -500, bankAccountId: "wells", date: "2026-05-05" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 0);
  });

  it("respects a custom window when provided", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase", date: "2026-05-01" }),
        txn({ id: "in", amount: -500, bankAccountId: "wells", date: "2026-05-05" }),
      ],
      { windowDays: 7, generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 1);
  });

  it("greedy-pairs each leg at most once when multiple candidates match", () => {
    // Two outflows of $500 from chase, two inflows of $500 at wells the next day.
    // Greedy + oldest-first should yield two distinct pairings, not one or four.
    const pairs = detectTransferPairs(
      [
        txn({ id: "out-1", amount: 500, bankAccountId: "chase", date: "2026-05-01" }),
        txn({ id: "out-2", amount: 500, bankAccountId: "chase", date: "2026-05-02" }),
        txn({ id: "in-1", amount: -500, bankAccountId: "wells", date: "2026-05-01" }),
        txn({ id: "in-2", amount: -500, bankAccountId: "wells", date: "2026-05-02" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 2);
    const claimedInflows = pairs.map(p => p.inflowId).sort();
    assert.deepEqual(claimedInflows, ["in-1", "in-2"]);
  });

  it("prefers the closer-date inflow when multiple match", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out", amount: 500, bankAccountId: "chase", date: "2026-05-01" }),
        txn({ id: "in-far", amount: -500, bankAccountId: "wells", date: "2026-05-03" }),
        txn({ id: "in-near", amount: -500, bankAccountId: "wells", date: "2026-05-01" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].inflowId, "in-near");
  });

  it("returns no pairs when only one direction exists", () => {
    const pairs = detectTransferPairs(
      [
        txn({ id: "out-1", amount: 500, bankAccountId: "chase" }),
        txn({ id: "out-2", amount: 250, bankAccountId: "chase" }),
      ],
      { generatePairId: makeCounter() },
    );
    assert.equal(pairs.length, 0);
  });

  it("returns no pairs on empty input", () => {
    assert.deepEqual(
      detectTransferPairs([], { generatePairId: makeCounter() }),
      [],
    );
  });
});
