"use client";

import { useEffect, useState } from "react";

import {
  claimBulkImportFileAction,
  heartbeatBulkImportFileAction,
  releaseBulkImportFileAction,
} from "@/modules/distribution/supplier-invoices/actions";

import {
  deriveLockState,
  type BulkImportLockState,
  type ClaimOutcome,
} from "./bulk-import-file-lock-state";

export type { BulkImportLockState, ClaimOutcome } from "./bulk-import-file-lock-state";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

/**
 * Advisory review-claim lifecycle for the bulk-import review queue. The
 * hook owns one slot:
 *   1. claim()  on mount (and whenever `bulkImportKey` changes)
 *   2. heartbeat every 60s while the claim is `owned`
 *   3. release() on unmount + key-change
 *
 * Refusal — when another reviewer holds the claim — surfaces as
 * `state.kind === "foreign"` with their user id and last-heartbeat time;
 * the shell renders a read-only banner instead of the editable form.
 *
 * A failed heartbeat (returns `false` from the server) means a stale-out
 * happened during the gap and someone else claimed it; we flip to
 * `foreign` so the UI catches up.
 *
 * The current state is *derived* from `(bulkImportKey, lastOutcome)` so
 * we never have to setState synchronously in the effect — the "claiming"
 * state happens automatically whenever the key changes faster than the
 * server can answer.
 */
export function useBulkImportFileLock(bulkImportKey: string | null): {
  state: BulkImportLockState;
  retry: () => void;
  /**
   * Explicit release — call before navigating away so we await the
   * server's response, instead of relying on the unmount cleanup
   * (which the browser may cancel mid-navigation). Idempotent and
   * safe to await even when we don't hold the claim.
   */
  releaseNow: () => Promise<void>;
} {
  // Last terminal outcome we received, tagged with the key it belongs to.
  // We only honor it when its key still matches `bulkImportKey` — otherwise
  // we're showing stale state from a previous row.
  const [lastOutcome, setLastOutcome] = useState<
    { key: string; result: ClaimOutcome } | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);

  // Derive the surface state via the pure helper. Retry bumping clears
  // `lastOutcome` so the banner switches to "claiming" the instant the
  // user clicks Retry — without that, the foreign banner sits unchanged
  // through the entire server roundtrip and the button feels broken.
  const state: BulkImportLockState = deriveLockState(
    bulkImportKey,
    lastOutcome,
  );

  useEffect(() => {
    if (!bulkImportKey) return;

    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      try {
        const result = await claimBulkImportFileAction(bulkImportKey);
        if (cancelled) return;

        if (result.ok) {
          setLastOutcome({ key: bulkImportKey, result: { kind: "owned" } });
          heartbeatTimer = setInterval(() => {
            void (async () => {
              try {
                const stillOurs =
                  await heartbeatBulkImportFileAction(bulkImportKey);
                if (cancelled) return;
                if (!stillOurs) {
                  // Stale-out: another reviewer claimed it during a gap.
                  // We don't know who took it (the heartbeat endpoint
                  // just returns a boolean) — Retry will re-claim and
                  // surface the new holder's name from the refusal path.
                  setLastOutcome({
                    key: bulkImportKey,
                    result: {
                      kind: "foreign",
                      claimedByUserId: "",
                      claimedByDisplayName: "Another reviewer",
                      claimedAt: null,
                    },
                  });
                  if (heartbeatTimer) {
                    clearInterval(heartbeatTimer);
                    heartbeatTimer = null;
                  }
                }
              } catch {
                // Transient network errors are fine — try again next tick.
              }
            })();
          }, HEARTBEAT_INTERVAL_MS);
        } else if (result.reason === "claimed_by_other") {
          setLastOutcome({
            key: bulkImportKey,
            result: {
              kind: "foreign",
              claimedByUserId: result.claimedByUserId,
              claimedByDisplayName: result.claimedByDisplayName,
              claimedAt: result.claimedAt,
            },
          });
        } else if (result.reason === "not_found") {
          setLastOutcome({
            key: bulkImportKey,
            result: { kind: "unavailable", reason: "not_found" },
          });
        } else if (result.reason === "already_reviewed") {
          setLastOutcome({
            key: bulkImportKey,
            result: { kind: "unavailable", reason: "already_reviewed" },
          });
        }
      } catch {
        // Initial-claim network hiccup — the derived state will remain
        // "claiming" indefinitely until the user clicks Retry or the
        // effect re-runs.
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      // Best-effort release. Fire-and-forget — the user is already
      // moving on, and the server-side TTL covers us if this call
      // never lands.
      void releaseBulkImportFileAction(bulkImportKey).catch(() => undefined);
    };
  }, [bulkImportKey, retryToken]);

  return {
    state,
    retry: () => {
      // Drop the cached outcome so the derived state flips to "claiming"
      // for the duration of the new claim request — instant visual
      // feedback while the server roundtrip is in flight.
      setLastOutcome(null);
      setRetryToken(t => t + 1);
    },
    releaseNow: async () => {
      if (!bulkImportKey) return;
      try {
        await releaseBulkImportFileAction(bulkImportKey);
      } catch {
        // The TTL covers us if this throws; not worth surfacing.
      }
    },
  };
}
