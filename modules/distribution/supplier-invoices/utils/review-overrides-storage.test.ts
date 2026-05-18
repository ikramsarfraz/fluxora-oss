import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  clearReviewOverrides,
  readReviewOverrides,
  writeReviewOverrides,
  type ReviewOverridesSnapshot,
} from "./review-overrides-storage";

class MockSessionStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(_index: number): string | null {
    return null;
  }
}

function emptySnapshot(): ReviewOverridesSnapshot {
  return {
    supplierIdOverride: null,
    supplierNameOverride: null,
    paymentMethodOverride: null,
    notesOverride: "",
    invoiceNumberOverride: "",
    invoiceDateOverride: "",
    receiveDateOverride: "",
    lineProductOverrides: {},
    skippedLines: [],
    deletedLineIds: [],
    lineCasesOverrides: {},
    lineWeightStates: {},
    lineLotExpiryStates: {},
    charges: [],
    acknowledgedCostKeys: [],
    acknowledgedMatchKey: null,
  };
}

beforeEach(() => {
  // Reset the window stub between tests so we don't leak storage.
  // The helper uses `window.sessionStorage` directly — no global
  // sessionStorage shortcut — so we attach to globalThis.window.
  (globalThis as unknown as { window: { sessionStorage: MockSessionStorage } }).window = {
    sessionStorage: new MockSessionStorage(),
  };
});

test("read returns null when nothing is persisted for the key", () => {
  assert.equal(readReviewOverrides("absent-key"), null);
});

test("read returns null when the bulkImportKey is null/empty", () => {
  assert.equal(readReviewOverrides(null), null);
  assert.equal(readReviewOverrides(undefined), null);
  assert.equal(readReviewOverrides(""), null);
});

test("write then read round-trips the snapshot intact", () => {
  const snapshot: ReviewOverridesSnapshot = {
    ...emptySnapshot(),
    supplierIdOverride: "supp-1",
    invoiceNumberOverride: "INV-243192",
    skippedLines: [1, 3, 5],
    lineCasesOverrides: { 2: 18, 7: 4 },
    acknowledgedCostKeys: [
      "prod-1::supp-1::1.2300",
      "prod-2::supp-1::0.5500",
    ],
  };
  writeReviewOverrides("key-a", snapshot);
  const read = readReviewOverrides("key-a");
  assert.deepEqual(read, snapshot);
});

test("read returns null when sessionStorage holds malformed JSON", () => {
  (globalThis as unknown as { window: { sessionStorage: MockSessionStorage } }).window.sessionStorage.setItem(
    "review:overrides:bad-json",
    "{not json",
  );
  assert.equal(readReviewOverrides("bad-json"), null);
});

test("read returns null when the schema version doesn't match", () => {
  (globalThis as unknown as { window: { sessionStorage: MockSessionStorage } }).window.sessionStorage.setItem(
    "review:overrides:wrong-version",
    JSON.stringify({ v: 9999, data: emptySnapshot() }),
  );
  assert.equal(readReviewOverrides("wrong-version"), null);
});

test("read returns null when the envelope is missing the version field", () => {
  (globalThis as unknown as { window: { sessionStorage: MockSessionStorage } }).window.sessionStorage.setItem(
    "review:overrides:no-version",
    JSON.stringify({ data: emptySnapshot() }),
  );
  assert.equal(readReviewOverrides("no-version"), null);
});

test("clear removes a previously-written snapshot", () => {
  writeReviewOverrides("key-b", emptySnapshot());
  assert.notEqual(readReviewOverrides("key-b"), null);
  clearReviewOverrides("key-b");
  assert.equal(readReviewOverrides("key-b"), null);
});

test("clear on an absent key is a no-op", () => {
  assert.doesNotThrow(() => clearReviewOverrides("never-set"));
});

test("snapshots are isolated per key", () => {
  writeReviewOverrides("key-c", {
    ...emptySnapshot(),
    notesOverride: "C-notes",
  });
  writeReviewOverrides("key-d", {
    ...emptySnapshot(),
    notesOverride: "D-notes",
  });
  assert.equal(readReviewOverrides("key-c")?.notesOverride, "C-notes");
  assert.equal(readReviewOverrides("key-d")?.notesOverride, "D-notes");
  clearReviewOverrides("key-c");
  // The other key's snapshot stays intact.
  assert.equal(readReviewOverrides("key-d")?.notesOverride, "D-notes");
});

test("read returns null gracefully when window is undefined (SSR)", () => {
  // Simulate the helper running in a server-side render: tear down
  // the window stub completely for this test.
  delete (globalThis as { window?: unknown }).window;
  assert.equal(readReviewOverrides("any-key"), null);
});
