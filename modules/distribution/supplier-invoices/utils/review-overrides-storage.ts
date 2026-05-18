"use client";

import type { ChargeDraft } from "../components/review/charges-panel";
import type { LineLotExpiryState } from "../components/review/line-lot-expiry-editor";
import type { LineWeightState } from "../components/review/line-weight-editor";
import type { PaymentMethod } from "../components/review/types";

/**
 * Snapshot of every review-screen override the user has made so far,
 * persisted to sessionStorage keyed on `bulkImportKey`. Survives a
 * tab refresh / accidental nav so a 20-minute reviewing session
 * isn't wiped by a misclick. Cleared on successful submit.
 *
 * Notes on shape:
 * - Sets are stored as arrays because `JSON.stringify(new Set())`
 *   silently yields `{}`. We round-trip via `Array.from` / `new Set`.
 * - Editor open-state (which weight/lot trays are expanded, whether
 *   the header is collapsed) is intentionally NOT persisted — it's
 *   transient UI state, not user data; bringing it back exactly
 *   after a refresh is more disorienting than starting fresh.
 * - PDF blob, cost-diff fetch state, etc. are not persisted — they
 *   re-derive from the server on mount.
 */
export type ReviewOverridesSnapshot = {
  supplierIdOverride: string | null;
  supplierNameOverride: string | null;
  paymentMethodOverride: PaymentMethod | null;
  notesOverride: string;
  invoiceNumberOverride: string;
  invoiceDateOverride: string;
  receiveDateOverride: string;
  lineProductOverrides: Record<
    number,
    { productId: string; productName: string; sku: string | null }
  >;
  skippedLines: number[];
  deletedLineIds: number[];
  lineCasesOverrides: Record<number, number>;
  lineWeightStates: Record<number, LineWeightState>;
  lineLotExpiryStates: Record<number, LineLotExpiryState>;
  charges: ChargeDraft[];
  acknowledgedCostKeys: string[];
  acknowledgedMatchKey: string | null;
};

const STORAGE_KEY_PREFIX = "review:overrides:";

/**
 * Bumped whenever the snapshot shape changes incompatibly — a
 * persisted snapshot from an older version of the app is discarded
 * (not restored) rather than risking a runtime error from a missing
 * or renamed field. Cheap; users just lose the in-progress overrides
 * once on the version-upgrade refresh.
 */
const SCHEMA_VERSION = 1;

type Envelope = { v: number; data: ReviewOverridesSnapshot };

function storageKey(bulkImportKey: string): string {
  return `${STORAGE_KEY_PREFIX}${bulkImportKey}`;
}

export function readReviewOverrides(
  bulkImportKey: string | null | undefined,
): ReviewOverridesSnapshot | null {
  if (!bulkImportKey || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(bulkImportKey));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<Envelope>;
    if (envelope?.v !== SCHEMA_VERSION || !envelope.data) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

export function writeReviewOverrides(
  bulkImportKey: string,
  snapshot: ReviewOverridesSnapshot,
): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope = { v: SCHEMA_VERSION, data: snapshot };
    window.sessionStorage.setItem(
      storageKey(bulkImportKey),
      JSON.stringify(envelope),
    );
  } catch {
    // QuotaExceeded / disabled-storage / private-mode — best-effort
    // persistence, so swallow rather than break the review flow.
  }
}

export function clearReviewOverrides(bulkImportKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(bulkImportKey));
  } catch {
    // Same swallow as above.
  }
}
