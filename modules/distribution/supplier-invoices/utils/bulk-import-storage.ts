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
  /** Unix-ms timestamp set when the user has reviewed + saved this file. */
  reviewedAt?: number;
  /** Resulting supplier-invoice id once the review submits a draft. */
  supplierInvoiceId?: string;
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
  preMintedKey?: string,
): string {
  const key =
    preMintedKey && preMintedKey.startsWith(BULK_IMPORT_LS_PREFIX)
      ? preMintedKey
      : `${BULK_IMPORT_LS_PREFIX}${randomKey()}`;
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
  // Best-effort cleanup of any matching PDF blob. The IndexedDB call is
  // fire-and-forget — the localStorage entry is the source of truth for
  // whether an item has been consumed.
  void clearPendingPdf(key);
}

/**
 * Drop the parse-result entry but keep the original PDF blob in IndexedDB.
 * Used by "Re-parse" affordances on the Review + bulk-landing screens — we
 * want the parser to run again on the same PDF without forcing the user to
 * re-upload.
 */
export function clearPendingBulkImportResultOnly(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// IndexedDB-backed PDF blob storage
//
// localStorage is fine for the parsed PipelineResult JSON (low KB), but PDF
// bytes routinely run into the 5–10 MB quota cap. IndexedDB gives us much
// more headroom (50%+ of free disk on most browsers), keyed by the same
// storage key the parse result uses so the review tab can fetch both with
// one identifier.
// ---------------------------------------------------------------------------

const PDF_DB_NAME = "fluxora-bulk-import";
const PDF_DB_VERSION = 1;
const PDF_STORE = "pdfs";

function openPdfDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(PDF_DB_NAME, PDF_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

type StoredPdf = {
  filename: string;
  type: string;
  storedAt: number;
  blob: Blob;
};

export async function storePendingPdf(key: string, file: File): Promise<void> {
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return;
  const db = await openPdfDb();
  if (!db) return;
  const value: StoredPdf = {
    filename: file.name,
    type: file.type,
    storedAt: Date.now(),
    blob: file,
  };
  await new Promise<void>(resolve => {
    const tx = db.transaction(PDF_STORE, "readwrite");
    tx.objectStore(PDF_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

export async function readPendingPdf(key: string): Promise<File | null> {
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return null;
  const db = await openPdfDb();
  if (!db) return null;
  const value = await new Promise<StoredPdf | null>(resolve => {
    const tx = db.transaction(PDF_STORE, "readonly");
    const req = tx.objectStore(PDF_STORE).get(key);
    req.onsuccess = () => resolve((req.result as StoredPdf | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  if (!value) return null;
  if (Date.now() - value.storedAt > ENTRY_TTL_MS) {
    void clearPendingPdf(key);
    return null;
  }
  // Reconstruct a `File` from the stored blob so downstream code (PDF pane,
  // attachment upload) gets a familiar shape.
  return new File([value.blob], value.filename, {
    type: value.type || "application/pdf",
  });
}

export async function clearPendingPdf(key: string): Promise<void> {
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return;
  const db = await openPdfDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    const tx = db.transaction(PDF_STORE, "readwrite");
    tx.objectStore(PDF_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

/** Mint a fresh storage key without writing anything yet — useful when the
 *  caller needs the key value before the data is available (e.g. to set up
 *  cross-tab links before the parse response returns). */
export function mintBulkImportKey(): string {
  return `${BULK_IMPORT_LS_PREFIX}${randomKey()}`;
}

/**
 * Snapshot of every non-expired bulk-import entry in localStorage. Used by
 * the new bulk-landing screen to drive its files table; the legacy bulk-
 * import panel manages its own component-local row state and doesn't need
 * this.
 *
 * Sorted by `storedAt` descending (newest first) so the landing screen
 * surfaces the most recent batch up top.
 */
export function listPendingBulkImports(): Array<{
  key: string;
  entry: StoredBulkImportEntry;
}> {
  if (typeof window === "undefined") return [];
  const out: Array<{ key: string; entry: StoredBulkImportEntry }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(BULK_IMPORT_LS_PREFIX)) continue;
    const entry = readPendingBulkImport(key);
    if (!entry) continue;
    out.push({ key, entry });
  }
  out.sort((a, b) => b.entry.storedAt - a.entry.storedAt);
  return out;
}

/**
 * Mark a localStorage entry as reviewed (the user has saved a draft from it).
 * Keeps the entry around until its TTL so the bulk-landing screen can show
 * it with the `Re-open →` affordance.
 */
export function markBulkImportReviewed(
  key: string,
  supplierInvoiceId?: string,
): void {
  if (!key.startsWith(BULK_IMPORT_LS_PREFIX)) return;
  if (typeof window === "undefined") return;
  const entry = readPendingBulkImport(key);
  if (!entry) return;
  const next: StoredBulkImportEntry = {
    ...entry,
    reviewedAt: Date.now(),
    supplierInvoiceId: supplierInvoiceId ?? entry.supplierInvoiceId,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota / private-mode failures */
  }
}
