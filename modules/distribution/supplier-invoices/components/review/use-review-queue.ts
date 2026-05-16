"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  listPendingBulkImportFilesAction,
  markBulkImportFileReviewedAction,
} from "../../actions";
import type { PipelineResult } from "../../services/parsing-pipeline";
import type { BulkImportFileRow } from "../../services/bulk-import-history";

import type { QueueEntry } from "./queue-types";

// ---------------------------------------------------------------------------
// Review queue hook. Pulls pending bulk-import rows from the server (the new
// durable history landed in PR A1) via React Query, derives card-shaped
// entries for the strip, and owns the per-session UI state — current
// selection, completion animation, slide direction.
//
// The hook is decoupled from any specific routing strategy: callers are
// responsible for syncing `currentKey` with the URL if they want deep-link
// support. Keys here are bulk_import_files.id UUIDs.
// ---------------------------------------------------------------------------

const QUEUE_KEY = ["bulk-import-files", "pending"] as const;

function buildQueueEntry(row: BulkImportFileRow): QueueEntry {
  const pipeline = row.pipelineResult;
  return {
    key: row.id,
    fileName: row.filename,
    supplierShort: deriveSupplierShort(pipeline, row.filename),
    invoiceShort: deriveInvoiceShort(pipeline),
    total: deriveTotal(pipeline),
    lineCount: pipeline?.prefillResult.values.lines.length ?? 0,
    needsReviewCount: countNeedsReview(pipeline),
    supplierMatched: Boolean(pipeline?.prefillResult.values.supplierId),
  };
}

function deriveSupplierShort(
  pipeline: PipelineResult | null,
  filename: string,
): string {
  const supplierName = pipeline?.prefillResult.unmatchedSupplierCandidates[0];
  if (supplierName && supplierName.trim().length > 0) return supplierName.trim();
  // Fall back to the source filename minus extension when nothing else is
  // available — better than blank cards on unmatched first-bill imports.
  return filename.replace(/\.pdf$/i, "");
}

function deriveInvoiceShort(pipeline: PipelineResult | null): string {
  const num = pipeline?.prefillResult.values.supplierInvoiceNumber;
  if (num && num.trim()) return `#${num.trim()}`;
  return "no invoice #";
}

function deriveTotal(pipeline: PipelineResult | null): number {
  if (!pipeline) return 0;
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

function countNeedsReview(pipeline: PipelineResult | null): number {
  if (!pipeline) return 0;
  return pipeline.unresolvedLines.filter(
    line => !line.suggestedProductId || line.confidence < 65,
  ).length;
}

export function useReviewQueue({
  initialKey,
}: {
  initialKey: string | null;
}) {
  // React Query keeps the list fresh on focus / visibility change; we also
  // invalidate explicitly after completeCurrent() so the carousel reflects
  // the new state without waiting for the next refetch interval.
  const query = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => listPendingBulkImportFilesAction(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const rows: BulkImportFileRow[] = useMemo(
    () => query.data ?? [],
    [query.data],
  );

  const [currentKey, setCurrentKey] = useState<string | null>(initialKey);
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<"prev" | "next">("next");

  // Derive the *effective* current key from queue + currentKey state. When
  // the stored currentKey is stale (queue moved on without it) we fall back
  // to the head of the queue. Doing this with useMemo keeps the React
  // Compiler happy and avoids a setState-in-effect cascade.
  const effectiveKey: string | null = useMemo(() => {
    if (rows.length === 0) return null;
    if (currentKey && rows.find(x => x.id === currentKey)) return currentKey;
    return rows[0].id;
  }, [rows, currentKey]);

  const queueEntries: QueueEntry[] = useMemo(
    () => rows.map(buildQueueEntry),
    [rows],
  );

  const idx = effectiveKey ? rows.findIndex(x => x.id === effectiveKey) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < rows.length - 1;

  const currentStored = idx >= 0 ? rows[idx] : null;

  const goPrev = useCallback(() => {
    if (idx <= 0) return;
    setDirection("prev");
    setCurrentKey(rows[idx - 1].id);
  }, [idx, rows]);

  const goNext = useCallback(() => {
    if (idx < 0 || idx >= rows.length - 1) return;
    setDirection("next");
    setCurrentKey(rows[idx + 1].id);
  }, [idx, rows]);

  const goTo = useCallback(
    (key: string) => {
      const nextIdx = rows.findIndex(x => x.id === key);
      if (nextIdx < 0) return;
      setDirection(nextIdx > idx ? "next" : "prev");
      setCurrentKey(key);
    },
    [idx, rows],
  );

  // Refetch the queue on visibilitychange — if a sibling tab completed an
  // entry, this picks it up the moment the user returns.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void query.refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [query]);

  // Trigger the completion animation: call the server to flip status to
  // 'reviewed', then refetch the queue. The animation timer runs in
  // parallel so the card slides out smoothly while the server confirms.
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
    },
    [],
  );

  const completeCurrent = useCallback(
    async ({
      supplierInvoiceId,
    }: { supplierInvoiceId?: string } = {}): Promise<void> => {
      if (!effectiveKey || !supplierInvoiceId) return;
      const completingId = effectiveKey;
      setCompletingKey(completingId);
      // Pre-select the next entry so when the queue updates and the current
      // id disappears, focus moves smoothly.
      const next = rows[idx + 1] ?? rows[idx - 1] ?? null;
      try {
        await markBulkImportFileReviewedAction({
          id: completingId,
          supplierInvoiceId,
        });
      } catch {
        // Mark-reviewed is best-effort: the bill itself is already posted,
        // we only fail to flip the queue row. Leaving the row pending is
        // recoverable (user can dismiss / soft-delete in Phase B).
      }
      if (completeTimer.current) clearTimeout(completeTimer.current);
      completeTimer.current = setTimeout(() => {
        void query.refetch();
        if (next) {
          setDirection("next");
          setCurrentKey(next.id);
        }
        setCompletingKey(null);
      }, 520);
    },
    [effectiveKey, idx, rows, query],
  );

  return {
    queue: queueEntries,
    currentKey: effectiveKey,
    currentStored,
    idx,
    hasPrev,
    hasNext,
    completingKey,
    direction,
    isLoading: query.isLoading,
    goPrev,
    goNext,
    goTo,
    completeCurrent,
  } as const;
}
