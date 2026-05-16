"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearPendingBulkImportResultOnly,
  readPendingPdf,
} from "../../utils/bulk-import-storage";
import type { PipelineResult } from "../../services/parsing-pipeline";

import { FloatingNav } from "./floating-nav";
import { QueueDone } from "./queue-done";
import { QueueStrip } from "./queue-strip";
import { ReviewContainer } from "./review-container";
import { ReviewQueueHeader } from "./review-queue-header";
import { useReviewQueue } from "./use-review-queue";

/**
 * Orchestrator for the new bulk-import Review Queue Carousel. Reads every
 * pending bulk-import entry on mount, lets the user move through them via
 * the strip, keyboard arrows, or the floating PDF-pane chrome, and animates
 * each completed invoice out of the queue.
 *
 * The single-PDF review path (when only one bulk-import entry exists or the
 * user is on the legacy form) still works because `ReviewContainer` is
 * mounted with the current entry and resets all per-invoice state via a key
 * prop. When the queue empties, the "All caught up" state takes over.
 */
export function ReviewQueueShell({
  initialKey,
}: {
  /**
   * localStorage key of the entry the user clicked into. We open the queue
   * positioned on this entry so deep-links from the bulk landing still land
   * on the file the user expected.
   */
  initialKey: string;
}) {
  const router = useRouter();
  const queueState = useReviewQueue({ initialKey });
  const {
    queue,
    currentKey,
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
  } = queueState;

  // PDF blob is fetched separately from IndexedDB. Keep it keyed to currentKey
  // so switching invoices replaces the blob (without re-running parsing).
  // We seed pdfFile with `null` on a key change via a render-time reset
  // (cheaper than setState-in-effect, and React Compiler-clean) before the
  // async IndexedDB read populates it.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileKey, setPdfFileKey] = useState<string | null>(currentKey);
  if (pdfFileKey !== currentKey) {
    setPdfFileKey(currentKey);
    setPdfFile(null);
  }
  useEffect(() => {
    if (!currentKey) return;
    let cancelled = false;
    void readPendingPdf(currentKey).then(file => {
      if (!cancelled) setPdfFile(file);
    });
    return () => {
      cancelled = true;
    };
  }, [currentKey]);

  // Submit-in-flight UI state — held here so the page header can disable the
  // Complete button while the action runs. ReviewContainer informs us by
  // calling onSubmitStart/onSubmitEnd.
  const [submitting, setSubmitting] = useState(false);

  // Keyboard ← / → switch invoices. Ignored while focus is in a text input
  // so date pickers and product search stay navigable with arrows.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  // Lock body + html overflow for the lifetime of the review queue. The
  // app's tenant layout sizes its main content slot with `min-h-svh` on the
  // sidebar wrapper, which means any descendant slightly bigger than the
  // viewport (due to subtle rounding, the parent's `p-4` + `gap-4`, or our
  // fixed-positioned bill-total bar) lets the document body scroll. The
  // review screen is a viewport-locked two-pane app surface — scrolling
  // belongs to the line items list, not the page. We restore the previous
  // overflow values on unmount so navigating away leaves other routes
  // untouched.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // When the queue is empty, render the all-caught-up state. The done card
  // animates on mount via the `review-done-burst` keyframe class.
  if (queue.length === 0) {
    return (
      <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col bg-stone-bg">
        <QueueDone onBackToBulk={() => router.push("/supplier-invoices/bulk")} />
      </main>
    );
  }

  if (!currentStored || !currentKey) return null;
  const pipelineResult: PipelineResult = currentStored.entry.item.pipelineResult;
  const fileName = currentStored.entry.filename;

  // Page header derives its labels from the queue state. The shell wires the
  // Skip / Complete & next CTAs back to the queue.
  const onReparse = () => {
    // Same affordance as the legacy ReviewContainer — drop the cached parse
    // and route the user through the parsing screen, which re-runs the
    // parser on the PDF blob still in IndexedDB.
    clearPendingBulkImportResultOnly(currentKey);
    router.push(`/supplier-invoices/parsing/${encodeURIComponent(currentKey)}`);
  };

  const header = (
    <ReviewQueueHeaderForCurrent
      fileName={fileName}
      pipelineResult={pipelineResult}
      position={idx + 1}
      total={queue.length}
      hasNext={hasNext}
      isLastRemaining={queue.length === 1}
      submitting={submitting}
      onBackToBulk={() => router.push("/supplier-invoices/bulk")}
      onSkip={goNext}
      onReparse={onReparse}
    />
  );

  return (
    <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col bg-stone-bg">
      <QueueStrip
        queue={queue}
        currentKey={currentKey}
        completingKey={completingKey}
        onPick={goTo}
        onPrev={goPrev}
        onNext={goNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      {/* ReviewContainer is mounted with the current key so per-invoice state
          (form overrides, skipped lines, supplier choice) resets cleanly each
          time the user switches invoices. On a successful post we hook the
          completion animation via `completeCurrent`. */}
      <ReviewContainer
        key={currentKey}
        fileName={fileName}
        pipelineResult={pipelineResult}
        pdfFile={pdfFile}
        bulkImportKey={currentKey}
        topSlot={null}
        headerSlot={header}
        pdfPaneAccessory={
          <FloatingNav
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        }
        paneEnterDirection={direction}
        // When the submit succeeds, animate the current card out + advance
        // to the next instead of routing away to the detail page.
        onSubmitStart={() => setSubmitting(true)}
        onSubmitEnd={() => setSubmitting(false)}
        onSubmitSuccess={({ supplierInvoiceId }) =>
          completeCurrent({ supplierInvoiceId })
        }
      />
    </main>
  );
}

/**
 * Thin wrapper that recomputes the header's counts from the current pipeline
 * result without re-deriving on every keystroke inside ReviewContainer. The
 * counts here come from the parser snapshot (which is what the queue strip
 * cards also use) — they don't reflect in-form edits, but the Complete
 * button is gated by parser counts anyway, so the gating is consistent.
 */
function ReviewQueueHeaderForCurrent({
  fileName,
  pipelineResult,
  position,
  total,
  hasNext,
  isLastRemaining,
  submitting,
  onBackToBulk,
  onSkip,
  onReparse,
}: {
  fileName: string;
  pipelineResult: PipelineResult;
  position: number;
  total: number;
  hasNext: boolean;
  isLastRemaining: boolean;
  submitting: boolean;
  onBackToBulk?: () => void;
  onSkip?: () => void;
  onReparse?: () => void;
}) {
  const counts = useMemo(() => {
    const lines = pipelineResult.prefillResult.values.lines;
    const matched = lines.filter(l => Boolean(l.productId)).length;
    const fees = pipelineResult.detectedFees.length;
    const needsReview =
      lines.length -
      matched +
      // Unresolved lines whose suggested match is low-confidence still need a
      // human pick.
      pipelineResult.unresolvedLines.filter(
        u => u.suggestedProductId && u.confidence < 65,
      ).length;
    return {
      matched,
      needsReview: Math.max(0, needsReview),
      fees,
      total: lines.length + fees,
    };
  }, [pipelineResult]);

  // The real "Complete" handler lives in ReviewContainer. We dispatch a
  // custom event so the queue header can stay decoupled from the form
  // internals. The container listens on the document and runs its submit.
  const handleComplete = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("review-queue:complete"));
  };

  return (
    <ReviewQueueHeader
      fileName={fileName}
      counts={counts}
      position={position}
      total={total}
      hasNext={hasNext}
      isLastRemaining={isLastRemaining}
      submitting={submitting}
      onBackToBulk={onBackToBulk}
      onReparse={onReparse}
      onSkip={onSkip}
      onComplete={handleComplete}
    />
  );
}
