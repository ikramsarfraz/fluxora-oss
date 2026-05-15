"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listPendingBulkImports,
  markBulkImportReviewed,
  type StoredBulkImportEntry,
} from "../../utils/bulk-import-storage";
import type { PipelineResult } from "../../services/parsing-pipeline";

import type { QueueEntry } from "./queue-types";

/**
 * Snapshot of every bulk-import entry that's still pending review (not yet
 * reviewed and not past its TTL). Ordered by `storedAt` ascending so the
 * queue carousel renders the oldest upload first — which matches the bulk
 * landing's row order. Run on mount + on visibilitychange so the queue
 * stays fresh when the user comes back from another tab.
 */
type StoredEntryWithKey = { key: string; entry: StoredBulkImportEntry };

function loadPending(): StoredEntryWithKey[] {
  return listPendingBulkImports()
    .filter(x => !x.entry.reviewedAt)
    .sort((a, b) => a.entry.storedAt - b.entry.storedAt);
}

function buildQueueEntry({
  key,
  entry,
}: StoredEntryWithKey): QueueEntry {
  const pipeline = entry.item.pipelineResult;
  return {
    key,
    fileName: entry.filename,
    supplierShort: deriveSupplierShort(pipeline, entry.filename),
    invoiceShort: deriveInvoiceShort(pipeline),
    total: deriveTotal(pipeline),
    lineCount: pipeline.prefillResult.values.lines.length,
    needsReviewCount: countNeedsReview(pipeline),
    supplierMatched: Boolean(pipeline.prefillResult.values.supplierId),
  };
}

function deriveSupplierShort(
  pipeline: PipelineResult,
  filename: string,
): string {
  const supplierName = pipeline.prefillResult.unmatchedSupplierCandidates[0];
  if (supplierName && supplierName.trim().length > 0) return supplierName.trim();
  // Fall back to the source filename minus extension when nothing else is
  // available — better than blank cards on unmatched first-bill imports.
  return filename.replace(/\.pdf$/i, "");
}

function deriveInvoiceShort(pipeline: PipelineResult): string {
  const num = pipeline.prefillResult.values.supplierInvoiceNumber;
  if (num && num.trim()) return `#${num.trim()}`;
  return "no invoice #";
}

function deriveTotal(pipeline: PipelineResult): number {
  const ext = pipeline.prefillResult.totalComparison.extractedTotal;
  if (ext != null) {
    const parsed = Number(ext);
    if (Number.isFinite(parsed)) return parsed;
  }
  const computed = pipeline.prefillResult.totalComparison.computedLineTotal;
  if (computed != null) {
    const parsed = Number(computed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function countNeedsReview(pipeline: PipelineResult): number {
  // Unresolved lines from the parser (no productId yet) plus any with a
  // low-confidence AI suggestion — mirrors `lineNeedsReview` in
  // map-pipeline-to-review-data.ts so the queue card count matches the
  // segmented filter's "Needs review" count inside the screen.
  return pipeline.unresolvedLines.filter(
    line => !line.suggestedProductId || line.confidence < 65,
  ).length;
}

/**
 * Hook that owns the review queue's UI state — the live queue list, current
 * file, completion animation, and slide direction. Returns ready-made action
 * callbacks for the queue strip and floating nav.
 *
 * The hook decoupled from any specific routing strategy: the consumer is
 * responsible for syncing `currentKey` with the URL if it wants deep-link
 * support. Keeps this hook safe to use in the bulk-import handoff flow that
 * lives entirely in localStorage today.
 */
export function useReviewQueue({
  initialKey,
}: {
  initialKey: string | null;
}) {
  const [queue, setQueue] = useState<StoredEntryWithKey[]>(() => loadPending());
  const [currentKey, setCurrentKey] = useState<string | null>(initialKey);
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<"prev" | "next">("next");

  // Re-snapshot localStorage when the user comes back to the tab — handles
  // the case where another tab finished reviewing a sibling entry.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setQueue(loadPending());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Derive the *effective* current key from queue + currentKey state. When the
  // stored currentKey is stale (queue moved on without it, e.g. another tab
  // completed the same entry) we fall back to the head of the queue. Doing
  // this with useMemo instead of a setState-in-effect keeps the React
  // Compiler happy and avoids the extra render that the cascade would cause.
  const effectiveKey: string | null = useMemo(() => {
    if (queue.length === 0) return null;
    if (currentKey && queue.find(x => x.key === currentKey)) return currentKey;
    return queue[0].key;
  }, [queue, currentKey]);

  const queueEntries: QueueEntry[] = useMemo(
    () => queue.map(buildQueueEntry),
    [queue],
  );

  const idx = effectiveKey
    ? queue.findIndex(x => x.key === effectiveKey)
    : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < queue.length - 1;

  const currentStored = idx >= 0 ? queue[idx] : null;

  const goPrev = useCallback(() => {
    if (idx <= 0) return;
    setDirection("prev");
    setCurrentKey(queue[idx - 1].key);
  }, [idx, queue]);

  const goNext = useCallback(() => {
    if (idx < 0 || idx >= queue.length - 1) return;
    setDirection("next");
    setCurrentKey(queue[idx + 1].key);
  }, [idx, queue]);

  const goTo = useCallback(
    (key: string) => {
      const nextIdx = queue.findIndex(x => x.key === key);
      if (nextIdx < 0) return;
      setDirection(nextIdx > idx ? "next" : "prev");
      setCurrentKey(key);
    },
    [idx, queue],
  );

  // Use effectiveKey as the outward currentKey so callers see the
  // post-staleness-fallback value. State is still kept in `currentKey` so
  // explicit navigation persists across re-renders.
  const currentKeyForCaller = effectiveKey;

  // Trigger the completion animation + queue removal. The caller passes the
  // newly-saved supplier-invoice id so we can persist `reviewedAt` to
  // localStorage (the bulk landing reads that to flip the row to "Reviewed").
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
    },
    [],
  );

  const completeCurrent = useCallback(
    ({ supplierInvoiceId }: { supplierInvoiceId?: string } = {}) => {
      if (!effectiveKey) return;
      const completingId = effectiveKey;
      setCompletingKey(completingId);
      // Pre-select the next entry so when the queue updates and the current
      // id disappears, focus moves smoothly.
      const next = queue[idx + 1] ?? queue[idx - 1] ?? null;
      // Slightly before the 550ms keyframe end to avoid a flash of the
      // collapsed-zero state on slow renders.
      if (completeTimer.current) clearTimeout(completeTimer.current);
      completeTimer.current = setTimeout(() => {
        markBulkImportReviewed(completingId, supplierInvoiceId);
        setQueue(q => q.filter(x => x.key !== completingId));
        if (next) {
          setDirection("next");
          setCurrentKey(next.key);
        }
        setCompletingKey(null);
      }, 520);
    },
    [effectiveKey, idx, queue],
  );

  return {
    queue: queueEntries,
    currentKey: currentKeyForCaller,
    currentStored,
    idx,
    hasPrev,
    hasNext,
    completingKey,
    direction,
    goPrev,
    goNext,
    goTo,
    completeCurrent,
  } as const;
}
