"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { BboxOverlay } from "./bbox-overlay";
import type { LineBbox } from "./line-bbox";
import { PdfCanvas } from "./pdf-canvas";
import type { ParsedLine } from "./types";

/**
 * PDF preview pane. The inner canvas is rendered by `pdfjs-dist` from the
 * original PDF bytes — what the user sees is the source-of-truth document,
 * not a reconstruction from parsed data. While the bytes are still being
 * fetched (or if the fetch fails) we render a loading skeleton / error
 * card; we deliberately never synthesize a stand-in invoice from parser
 * output because doing so could mask mis-mapped fields behind a
 * professional-looking visual.
 */
export function PdfPane({
  fileName,
  page,
  pages,
  onPageChange,
  zoom,
  onZoom,
  lines,
  activeLineId,
  onLineClick,
  pdfFile,
  pdfLoadError = false,
  lineBboxes,
  paneEnterClass,
  accessory,
}: {
  fileName: string;
  page: number;
  pages: number;
  /** Controlled page change. When omitted, the toolbar's page buttons are
   *  hidden (single-page invoices). */
  onPageChange?: (page: number) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  lines: ParsedLine[];
  activeLineId: number | null;
  onLineClick: (id: number) => void;
  /**
   * Original PDF bytes. Null while the host is fetching them; once set,
   * pdfjs renders them straight to a canvas.
   */
  pdfFile?: Blob | null;
  /**
   * True when the host gave up fetching the PDF (signed-URL request failed,
   * R2 GET errored, etc.). Distinguishes "still loading" from "we can't
   * get the bytes" — the loading skeleton would otherwise persist forever
   * and look like a hang.
   */
  pdfLoadError?: boolean;
  /** Per-line bounding boxes — required for clickable overlays on the real PDF. */
  lineBboxes?: LineBbox[];
  /** Optional CSS class to layer the pane-enter slide animation on. */
  paneEnterClass?: string;
  /**
   * Optional overlay rendered inside the pane container. Used by the queue
   * carousel to drop floating prev/next buttons at the pane edges. Children
   * receive PdfPane as the nearest positioned ancestor so their absolute
   * coordinates stay within the dark pane regardless of viewport width.
   */
  accessory?: React.ReactNode;
}) {
  // Real PDF canvases are rendered at native CSS size scaled by zoom, so
  // bboxes (in PDF user-space points) need `zoom/100` to align with the canvas.
  const overlayScale = zoom / 100;

  // The pipeline result doesn't carry page count, so the `pages` prop is
  // usually a default of 1. We let pdfjs tell us the real count via
  // `onPageCount` once it parses the PDF, and reset whenever a new file
  // loads so a previous multi-page count doesn't bleed into a single-page
  // invoice.
  const [discoveredPageCount, setDiscoveredPageCount] = useState<number | null>(
    null,
  );
  useEffect(() => {
    setDiscoveredPageCount(null);
  }, [pdfFile]);
  const handlePageCount = useCallback((count: number) => {
    setDiscoveredPageCount(count);
  }, []);
  const effectivePages = discoveredPageCount ?? pages;

  return (
    <div
      className={cn("relative flex min-w-0 flex-1 flex-col", paneEnterClass)}
      style={{
        background: "#1a1a1a",
        borderRight: "1px solid var(--color-border-default)",
      }}
    >
      {accessory}
      <PdfToolbar
        fileName={fileName}
        page={page}
        pages={effectivePages}
        zoom={zoom}
        onZoom={onZoom}
        onPageChange={onPageChange}
        pdfFile={pdfFile ?? null}
      />
      <div
        className="flex flex-1 justify-center overflow-y-auto p-6"
        style={{ alignItems: "flex-start" }}
      >
        {pdfFile ? (
          <PdfCanvas
            pdfFile={pdfFile}
            pageNumber={page}
            zoom={zoom}
            onPageCount={handlePageCount}
          >
            {lineBboxes ? (
              <BboxOverlay
                bboxes={lineBboxes}
                lines={lines}
                activeLineId={activeLineId}
                scale={overlayScale}
                pageNumber={page}
                onLineClick={onLineClick}
              />
            ) : null}
          </PdfCanvas>
        ) : pdfLoadError ? (
          <PdfFetchErrorCard fileName={fileName} />
        ) : (
          <PdfLoadingSkeleton />
        )}
      </div>
    </div>
  );
}

/**
 * Shown while the host is fetching the PDF bytes from R2. Mirrors the
 * shape of a real PDF page (white card with rounded shadow) so the layout
 * doesn't jump when the canvas swaps in.
 */
function PdfLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      style={{
        width: 680,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: "42px 48px",
      }}
    >
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-6 flex flex-col gap-2.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
      <div
        className="mt-6 text-center font-mono text-[10px]"
        style={{ color: "#9ca3af" }}
      >
        Loading original PDF…
      </div>
    </div>
  );
}

/**
 * Shown when the host's fetch for the PDF bytes failed irrecoverably. We
 * surface the failure explicitly so the reviewer never compares parsed
 * lines against an invisible / placeholder source — the safe action is to
 * skip this invoice in the queue or re-upload it from the Imports tab.
 */
function PdfFetchErrorCard({ fileName }: { fileName: string }) {
  return (
    <div
      className="flex max-w-[480px] flex-col items-center gap-3 rounded-[12px] border text-center"
      style={{
        background: "#fff",
        borderColor: "oklch(82% 0.06 25)",
        padding: "32px 28px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="flex size-10 items-center justify-center rounded-full"
        style={{ background: "oklch(94% 0.05 25)" }}
      >
        <AlertTriangle
          className="size-5"
          strokeWidth={1.8}
          style={{ color: "oklch(48% 0.18 25)" }}
        />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-ink">
          Couldn&apos;t load the original PDF
        </div>
        <div className="mt-1 font-mono text-[12px] text-subtle">
          {fileName}
        </div>
      </div>
      <p className="text-[13px] leading-[1.5] text-subtle">
        We weren&apos;t able to fetch the source file from storage. Reviewing
        without the original isn&apos;t safe — skip this invoice or re-upload it
        from the Imports tab to retry.
      </p>
    </div>
  );
}

function PdfToolbar({
  fileName,
  page,
  pages,
  zoom,
  onZoom,
  onPageChange,
  pdfFile,
}: {
  fileName: string;
  page: number;
  pages: number;
  zoom: number;
  onZoom: (zoom: number) => void;
  /** Optional — when omitted the prev/next page buttons stay hidden. Multi-
   *  page invoices need this; single-page parses leave it off so the toolbar
   *  doesn't show disabled chrome the user can't interact with. */
  onPageChange?: (page: number) => void;
  /**
   * Loaded PDF bytes. When set, the "Open original" button is enabled and
   * opens the raw blob in a new tab via an object URL — lets the reviewer
   * cross-check our pdfjs render against the browser's native PDF viewer
   * without trusting our pipeline.
   */
  pdfFile: Blob | null;
}) {
  const handleOpenOriginal = () => {
    if (!pdfFile) return;
    const url = URL.createObjectURL(pdfFile);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke after a delay so the new tab has time to claim the URL.
    // Browsers GC blob URLs on unload too, so this is just hygiene.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div
      className="flex h-[42px] items-center gap-2.5 border-b px-3.5 text-[12px]"
      style={{
        background: "#1a1a1a",
        borderColor: "#2a2a2a",
        color: "#d4d4d4",
      }}
    >
      <span
        className="max-w-[180px] truncate font-mono"
        style={{ color: "#9ca3af" }}
      >
        {fileName}
      </span>
      <div className="flex-1" />
      {pages > 1 && onPageChange ? (
        <>
          <ToolbarButton
            onClick={() => onPageChange(Math.max(1, page - 1))}
            label="Previous page"
            disabled={page <= 1}
          >
            <ChevronLeft className="size-[14px]" strokeWidth={1.6} />
          </ToolbarButton>
          <span
            className="min-w-[64px] text-center font-mono tabular-nums"
            style={{ color: "#d4d4d4" }}
          >
            {page} / {pages}
          </span>
          <ToolbarButton
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            label="Next page"
            disabled={page >= pages}
          >
            <ChevronRight className="size-[14px]" strokeWidth={1.6} />
          </ToolbarButton>
        </>
      ) : (
        <span style={{ color: "#9ca3af" }}>
          Page {page} / {pages}
        </span>
      )}
      <div className="h-[18px] w-px" style={{ background: "#3a3a3a" }} />
      <ToolbarButton
        onClick={() => onZoom(Math.max(40, zoom - 10))}
        label="Zoom out"
      >
        <ZoomOut className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
      <span
        className="w-[42px] text-center font-mono"
        style={{ color: "#d4d4d4" }}
      >
        {zoom}%
      </span>
      <ToolbarButton
        onClick={() => onZoom(Math.min(200, zoom + 10))}
        label="Zoom in"
      >
        <ZoomIn className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
      <div className="h-[18px] w-px" style={{ background: "#3a3a3a" }} />
      <ToolbarButton onClick={() => onZoom(100)} label="Fit width">
        <Maximize2 className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
      <div className="h-[18px] w-px" style={{ background: "#3a3a3a" }} />
      <ToolbarButton
        onClick={handleOpenOriginal}
        label="Open original PDF in a new tab"
        disabled={!pdfFile}
      >
        <ExternalLink className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "flex size-[26px] items-center justify-center rounded-[5px] bg-transparent transition-colors",
        "enabled:hover:bg-card/10",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
      style={{ color: "#d4d4d4" }}
    >
      {children}
    </button>
  );
}

/**
 * Empty placeholder for the left column of the fixed bottom bar. The bar
 * is a `grid grid-cols-2` aligned with the two-pane row above; without
 * this div, ReviewFooterStrip would collapse to the left and the
 * bill-total would stop lining up with the right pane. Renders nothing
 * visible — kept as an exported component so the host's two-column shape
 * stays declarative.
 */
export function PdfHint() {
  return <div aria-hidden />;
}
