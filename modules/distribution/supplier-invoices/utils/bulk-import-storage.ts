// Browser-only helpers for handing parsed pipeline results from the bulk-
// import panel to the single-import flow, via localStorage.
//
// Why localStorage and not a server-side table? The bulk parse already
// returns the full PipelineResult JSON. Persisting it to the DB would mean
// a new schema, R2 PDF storage, expiry, and a second review surface — out
// of scope for a UX fix. localStorage gives us cross-tab continuity (open
// each "Review →" link in a new tab without losing the bulk-import page)
// at the cost of state being per-browser and lost on cache clear, which is
// acceptable for an ephemeral review handoff.

import type { BulkImportItemResult } from "../services/bulk-import";

export const BULK_IMPORT_LS_PREFIX = "fluxora:bulk-import:";

/** Entries older than this are silently dropped on read. */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type StoredBulkImportEntry = {
  filename: string;
  storedAt: number;
  /** Full bulk-import item — the .pipelineResult inside is what the form needs. */
  item: BulkImportItemResult & { status: "parsed" };
};

function randomKey(): string {
  // Browser crypto when available; fall back to a slightly-less-random
  // pattern so we still produce something usable in odd environments
  // (tests, embedded webviews) without throwing.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persist a parsed bulk-import item and return the localStorage key to
 * embed in the review link. Caller is responsible for clearing the entry
 * once the user has consumed it (or via the panel's "Start over" button).
 */
export function storePendingBulkImport(
  item: BulkImportItemResult & { status: "parsed" },
): string {
  const key = `${BULK_IMPORT_LS_PREFIX}${randomKey()}`;
  const entry: StoredBulkImportEntry = {
    filename: item.filename,
    storedAt: Date.now(),
    item,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota / private mode failure — the panel will surface "no parse to
    // review" when the consumer can't find the key, so we don't need to
    // bubble this up. Telemetry could go here later.
  }
  return key;
}

/**
 * Read and return the parsed pipeline result for a given storage key, or
 * null if nothing is there or the entry is past its TTL. Does NOT remove
 * the entry — call `clearPendingBulkImport` once the user has saved a
 * draft from it.
 */
export function readPendingBulkImport(
  key: string,
): StoredBulkImportEntry | null {
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return null;
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: StoredBulkImportEntry;
  try {
    parsed = JSON.parse(raw) as StoredBulkImportEntry;
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed.storedAt !== "number" ||
    !parsed.item ||
    parsed.item.status !== "parsed"
  ) {
    return null;
  }
  if (Date.now() - parsed.storedAt > ENTRY_TTL_MS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
  return parsed;
}

export function clearPendingBulkImport(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
