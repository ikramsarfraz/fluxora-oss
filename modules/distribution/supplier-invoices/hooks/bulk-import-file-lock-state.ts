/**
 * Pure state-derivation helpers for the bulk-import-file advisory claim.
 * Split out of `use-bulk-import-file-lock.ts` because that hook imports
 * server actions, which the Node test runner can't load — keeping these
 * types + the derivation function in a server-import-free file lets a
 * unit test pin the table of cases without bringing in React.
 */

/**
 * Surface state the banner reads each render.
 *  - `idle`        — no key (queue empty, etc.)
 *  - `claiming`    — claim request in flight (initial mount or retry)
 *  - `owned`       — this user holds the claim, heartbeating in background
 *  - `foreign`     — another user holds the claim, we're locked out
 *  - `unavailable` — the row vanished or was already reviewed
 */
export type BulkImportLockState =
  | { kind: "idle" }
  | { kind: "claiming" }
  | { kind: "owned" }
  | {
      kind: "foreign";
      claimedByUserId: string;
      /** Display name of the reviewer holding the claim, for the banner copy. */
      claimedByDisplayName: string;
      claimedAt: Date | null;
    }
  | { kind: "unavailable"; reason: "not_found" | "already_reviewed" };

/** Terminal claim outcomes (everything except idle / claiming). */
export type ClaimOutcome = Exclude<
  BulkImportLockState,
  { kind: "idle" } | { kind: "claiming" }
>;

/**
 * Pure state-derivation: given the current key and the most recently
 * stored outcome, what should the banner show right now? Exported so a
 * unit test can pin down the tricky races (key changes mid-claim, retry
 * resets, etc.) without rendering React.
 */
export function deriveLockState(
  bulkImportKey: string | null,
  lastOutcome: { key: string; result: ClaimOutcome } | null,
): BulkImportLockState {
  if (!bulkImportKey) return { kind: "idle" };
  if (lastOutcome?.key === bulkImportKey) return lastOutcome.result;
  return { kind: "claiming" };
}
