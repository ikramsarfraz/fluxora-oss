"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getBulkImportPdfSignedUrlAction } from "../../actions";
import type { AiExtractionErrorCode } from "../../services/ai-provider";
import type { PipelineResult } from "../../services/parsing-pipeline";

import { FloatingNav } from "./floating-nav";
import { QueueDone } from "./queue-done";
import { QueueStrip } from "./queue-strip";
import { ReviewContainer } from "./review-container";
import { ReviewQueueHeader } from "./review-queue-header";
import type { ReviewCounts } from "./types";
import { useReviewQueue } from "./use-review-queue";

/** User-facing message per AI failure class for the queue-failed card. */
const QUEUE_PARSE_ERROR_LABEL: Record<AiExtractionErrorCode, string> = {
  connection: "OpenAI couldn't be reached while parsing this invoice.",
  timeout: "OpenAI took too long to respond while parsing this invoice.",
  rate_limit: "OpenAI rate-limited the request — please retry in a moment.",
  refusal: "OpenAI declined to parse this document.",
  post_validation: "AI returned a response we couldn't validate.",
  no_output: "AI produced no output for this document.",
  unknown: "An unexpected error occurred while parsing this invoice.",
};

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
    isLoading,
    goPrev,
    goNext,
    goTo,
    completeCurrent,
  } = queueState;

  // PDF blob now comes from R2 via a short-lived signed URL — no more
  // IndexedDB cache. We refetch the URL whenever the current invoice
  // changes; PdfPane downloads the bytes itself via fetch. We seed pdfFile
  // with `null` on a key change via a render-time reset (cheaper than
  // setState-in-effect, and React Compiler-clean) before the async signed-
  // URL fetch + download populates it.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileKey, setPdfFileKey] = useState<string | null>(currentKey);
  if (pdfFileKey !== currentKey) {
    setPdfFileKey(currentKey);
    setPdfFile(null);
  }
  useEffect(() => {
    if (!currentKey) return;
    let cancelled = false;
    void (async () => {
      const url = await getBulkImportPdfSignedUrlAction(currentKey).catch(
        () => null,
      );
      if (!url || cancelled) return;
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled) return;
      // Wrap in a `File` so downstream consumers (PdfPane, attachment upload
      // in ReviewContainer) get the familiar shape they had with IndexedDB.
      const filename = currentStored?.filename ?? "invoice.pdf";
      const mime = currentStored?.mimeType ?? "application/pdf";
      setPdfFile(new File([blob], filename, { type: mime }));
    })();
    return () => {
      cancelled = true;
    };
  }, [currentKey, currentStored?.filename, currentStored?.mimeType]);

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

  // // Lock body + html overflow for the lifetime of the review queue. The
  // // app's tenant layout sizes its main content slot with `min-h-svh` on the
  // // sidebar wrapper, which means any descendant slightly bigger than the
  // // viewport (due to subtle rounding, the parent's `p-4` + `gap-4`, or our
  // // fixed-positioned bill-total bar) lets the document body scroll. The
  // // review screen is a viewport-locked two-pane app surface — scrolling
  // // belongs to the line items list, not the page. We restore the previous
  // // overflow values on unmount so navigating away leaves other routes
  // // untouched.
  // useEffect(() => {
  //   if (typeof document === "undefined") return;
  //   const html = document.documentElement;
  //   const body = document.body;
  //   const prevHtmlOverflow = html.style.overflow;
  //   const prevBodyOverflow = body.style.overflow;
  //   html.style.overflow = "hidden";
  //   body.style.overflow = "hidden";
  //   return () => {
  //     html.style.overflow = prevHtmlOverflow;
  //     body.style.overflow = prevBodyOverflow;
  //   };
  // }, []);

  // First-render guard: React Query starts with `data === undefined`, which
  // would otherwise make `queue.length === 0` true and flash <QueueDone />
  // for a single frame before the real list arrives. Show a skeleton of the
  // two-pane layout so the user sees the page shape immediately rather than
  // a misleading "All caught up" celebration or a blank window.
  if (isLoading && queue.length === 0) {
    return <ReviewQueueSkeleton />;
  }

  // When the queue is empty AND the fetch has settled, render the
  // all-caught-up state. The done card animates on mount via the
  // `review-done-burst` keyframe class.
  if (queue.length === 0) {
    return (
      <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col overflow-hidden bg-stone-bg">
        <QueueDone
          onBackToBulk={() => router.push("/supplier-invoices/bulk")}
        />
      </main>
    );
  }

  if (!currentStored || !currentKey) return null;
  const pipelineResult: PipelineResult | null = currentStored.pipelineResult;
  const fileName = currentStored.filename;
  if (!pipelineResult) return null;

  // parse_error rows are not reviewable as-is — the AI failed mid-parse and
  // there's nothing meaningful in the prefill to edit. Render a compact
  // failure card instead of the form so the user (a) knows what went wrong
  // and (b) can navigate past it without being misled by an empty form.
  if (pipelineResult.parseStatus === "parse_error") {
    return (
      <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col overflow-hidden bg-stone-bg">
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
        <QueueFailedCard
          fileName={fileName}
          parseErrorCodes={pipelineResult.parseErrorCodes}
          onBackToBulk={() => router.push("/supplier-invoices/bulk")}
          onSkip={hasNext ? goNext : undefined}
        />
      </main>
    );
  }

  // Re-parse on the server side is out of scope for this PR — the legacy
  // parsing screen route reads from localStorage / IndexedDB, which the
  // server-side flow no longer populates. We hide the affordance until the
  // server-side re-parse lands (tracked as a follow-up).
  const onReparse: (() => void) | undefined = undefined;

  // Render as a function so the ReviewScreen can hand back its
  // form-state-aware `counts` (which include in-form product/supplier
  // resolutions) and the host-managed `submitDisabled` flag (covers the
  // duplicate-bill ack checkbox and in-flight submits). Computing either
  // here from `pipelineResult` would freeze gating at the parser snapshot.
  const renderHeader = ({
    counts,
    submitDisabled,
  }: {
    counts: ReviewCounts;
    submitDisabled: boolean;
  }) => (
    <ReviewQueueHeaderForCurrent
      fileName={fileName}
      counts={counts}
      position={idx + 1}
      total={queue.length}
      hasNext={hasNext}
      isLastRemaining={queue.length === 1}
      submitting={submitting}
      submitDisabled={submitDisabled}
      onBackToBulk={() => router.push("/supplier-invoices/bulk")}
      onSkip={goNext}
      onReparse={onReparse}
    />
  );

  return (
    <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col overflow-hidden bg-stone-bg">
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
        headerSlot={renderHeader}
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
 * Compact card shown in place of the editable form when the current queue
 * entry has `parseStatus === "parse_error"`. The user can navigate past it
 * with the strip or the Skip button; recovery is a re-upload from the
 * bulk-import panel (Re-parse against the same R2 object is a follow-up).
 */
function QueueFailedCard({
  fileName,
  parseErrorCodes,
  onBackToBulk,
  onSkip,
}: {
  fileName: string;
  parseErrorCodes: AiExtractionErrorCode[];
  onBackToBulk: () => void;
  onSkip?: () => void;
}) {
  const primaryCode = parseErrorCodes[0] ?? "unknown";
  const primaryMessage = QUEUE_PARSE_ERROR_LABEL[primaryCode];

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="flex max-w-[480px] flex-col gap-4 rounded-[12px] border border-stone-line bg-stone-surface p-6 text-center">
        <div
          className="mx-auto flex size-10 items-center justify-center rounded-full"
          style={{ background: "oklch(94% 0.05 25)" }}
        >
          <AlertTriangle
            className="size-5"
            strokeWidth={1.8}
            style={{ color: "oklch(48% 0.18 25)" }}
          />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-stone-ink">Parse failed</div>
          <div className="mt-1 font-mono text-[12px] text-stone-muted">{fileName}</div>
        </div>
        <p className="text-[13px] leading-[1.5] text-stone-muted">
          {primaryMessage} Re-upload this PDF from the bulk-import panel to
          retry. The original file is preserved in your batch history.
        </p>
        {parseErrorCodes.length > 0 ? (
          <p
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-stone-muted"
            aria-label="Failure codes"
          >
            {parseErrorCodes.join(" · ")}
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBackToBulk}>
            Back to bulk import
          </Button>
          {onSkip ? (
            <Button type="button" size="sm" onClick={onSkip}>
              Skip to next
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading-state placeholder shown while the first queue fetch is in flight.
 * Mirrors the eventual two-pane layout — queue strip on top, PDF pane on
 * the left, header card + line items list on the right — so the page shape
 * is stable across the loading → loaded transition.
 */
function ReviewQueueSkeleton() {
  return (
    <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col overflow-hidden bg-stone-bg">
      {/* Queue strip */}
      <div className="flex shrink-0 items-center gap-2 border-b border-stone-line bg-stone-surface px-4 py-3">
        <div className="flex flex-col gap-1.5 border-r border-stone-line pr-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-44 shrink-0" />
        ))}
      </div>

      {/* Two-pane body */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* PDF pane */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="min-h-0 flex-1" />
        </div>

        {/* Right pane */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 bg-stone-surface p-4">
          {/* Header card */}
          <div className="flex flex-col gap-3 rounded-md border border-stone-line bg-stone-bg p-4">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>

          {/* Line items */}
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full shrink-0" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Thin wrapper around the queue page header. Counts are passed in from
 * ReviewScreen via the `headerSlot` render prop so the "Resolve N to
 * continue" gating tracks in-form product/supplier resolutions instead of
 * the frozen parser snapshot.
 */
function ReviewQueueHeaderForCurrent({
  fileName,
  counts,
  position,
  total,
  hasNext,
  isLastRemaining,
  submitting,
  submitDisabled,
  onBackToBulk,
  onSkip,
  onReparse,
}: {
  fileName: string;
  counts: ReviewCounts;
  position: number;
  total: number;
  hasNext: boolean;
  isLastRemaining: boolean;
  submitting: boolean;
  /**
   * Outer guard — currently set by ReviewContainer when an unacknowledged
   * posted-duplicate banner is showing, or while a submit is in flight.
   * Disabling the Complete button when this is true keeps the queue header
   * in sync with the rest of the form's gating.
   */
  submitDisabled: boolean;
  onBackToBulk?: () => void;
  onSkip?: () => void;
  onReparse?: () => void;
}) {
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
      submitDisabled={submitDisabled}
      onBackToBulk={onBackToBulk}
      onReparse={onReparse}
      onSkip={onSkip}
      onComplete={handleComplete}
    />
  );
}
