"use client";

import { useEffect, useRef, useState } from "react";

import { REVIEW_COLORS } from "./tokens";

export type RenderedPageSize = {
  /** CSS pixel width of the rendered canvas (post-DPI scaling). */
  width: number;
  /** CSS pixel height of the rendered canvas. */
  height: number;
  /** PDF.js viewport width at the given scale — used to convert PDF coords to screen. */
  viewportWidth: number;
  /** PDF.js viewport height at the given scale. */
  viewportHeight: number;
};

type RenderResult =
  | { kind: "ready"; size: RenderedPageSize }
  | { kind: "error"; message: string };

/**
 * Renders one page of a PDF to a canvas using `pdfjs-dist`. The wrapper
 * positions an absolute-positioned overlay container above the canvas;
 * children (typically <BboxOverlay />) sit in that overlay.
 *
 * Falls back to rendering `fallback` when no `pdfFile` is provided — used in
 * the demo so the screen is still meaningful before phase 5 wires a real source.
 */
export function PdfCanvas({
  pdfFile,
  pageNumber,
  zoom,
  fallback,
  children,
  onPageSize,
}: {
  pdfFile?: Blob | null;
  pageNumber: number;
  /** Percentage, e.g. 85 → 0.85x. */
  zoom: number;
  /** Rendered when no `pdfFile` is provided. */
  fallback?: React.ReactNode;
  /** Overlay content (bboxes). */
  children?: React.ReactNode;
  onPageSize?: (size: RenderedPageSize) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Result of the in-flight or completed render. While the effect is mid-flight,
  // `result` reflects the previous render; the loading overlay covers the canvas
  // until the .then/.catch callback below replaces it.
  const [result, setResult] = useState<RenderResult | null>(null);

  useEffect(() => {
    if (!pdfFile) return;
    // The handle captures the in-flight pdfjs tasks so the cleanup below can
    // actually stop them. Without this, React 19's strict-mode double-invoke
    // starts two `page.render()` calls on the same canvas and pdfjs throws
    // "Cannot use the same canvas during multiple render() operations".
    const handle: RenderHandle = { cancelled: false };

    void renderPdfPage({
      pdfFile,
      pageNumber,
      zoom,
      canvas: canvasRef.current,
      handle,
    })
      .then(size => {
        if (handle.cancelled) return;
        setResult({ kind: "ready", size });
        onPageSize?.(size);
      })
      .catch((err: unknown) => {
        if (handle.cancelled || isCancellationError(err)) return;
        console.error("[pdf-canvas] failed to render", err);
        setResult({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to render PDF",
        });
      });

    return () => {
      handle.cancelled = true;
      handle.renderTask?.cancel();
      // `destroy()` returns a promise; we don't await it — the cleanup must
      // be synchronous and pdfjs is happy to be told to tear down in flight.
      void handle.loadingTask?.destroy();
    };
  }, [pdfFile, pageNumber, zoom, onPageSize]);

  if (!pdfFile) {
    return (
      <div ref={wrapperRef} className="relative inline-block">
        {fallback}
        <div className="pointer-events-none absolute inset-0">
          <div className="relative size-full">{children}</div>
        </div>
      </div>
    );
  }

  const pageSize = result?.kind === "ready" ? result.size : null;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <canvas ref={canvasRef} className="block bg-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]" />
      {result === null ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.6)", color: REVIEW_COLORS.mutedSoft }}
        >
          Loading PDF…
        </div>
      ) : null}
      {result?.kind === "error" ? (
        <div
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12px]"
          style={{ background: "rgba(255,255,255,0.9)", color: REVIEW_COLORS.danger }}
        >
          {result.message}
        </div>
      ) : null}
      {pageSize ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          <div className="relative size-full">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

let workerConfigured = false;

type PdfRenderTask = { cancel: () => void; promise: Promise<void> };
type PdfLoadingTask = { promise: Promise<unknown>; destroy: () => Promise<void> };

/**
 * Cancellation surface shared between the effect and `renderPdfPage`. The
 * effect installs the loading/render tasks on the handle as soon as pdfjs
 * hands them over so the cleanup can tear them down synchronously.
 */
type RenderHandle = {
  cancelled: boolean;
  loadingTask?: PdfLoadingTask;
  renderTask?: PdfRenderTask;
};

async function renderPdfPage({
  pdfFile,
  pageNumber,
  zoom,
  canvas,
  handle,
}: {
  pdfFile: Blob;
  pageNumber: number;
  zoom: number;
  canvas: HTMLCanvasElement | null;
  handle: RenderHandle;
}): Promise<RenderedPageSize> {
  if (!canvas) throw new Error("Canvas not mounted");

  // pdfjs-dist is server-external (see next.config.ts) so import dynamically
  // inside the client effect to avoid pulling it into the RSC bundle.
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Point the worker at a version-pinned jsDelivr URL rather than going
    // through the bundler. `pdfjs.version` reads from the installed package
    // so the worker stays in lockstep with the API build; jsDelivr serves the
    // file as an immutable artifact so it caches indefinitely.
    //
    // Routing through `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`
    // would trip Turbopack's serverExternalPackages matcher (warning:
    // "Package pdfjs-dist can't be external") and force a workaround there;
    // the CDN approach keeps both the server-side text extractor and the
    // client renderer happy.
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    workerConfigured = true;
  }

  // Read the bytes straight from the Blob and feed them to pdfjs as `data`.
  // We deliberately do NOT route through an object URL: pdfjs's URL path
  // (and `fetch()` of a `blob:` URL) is flaky across browsers/Turbopack —
  // the symptoms range from "Unexpected server response (0) while retrieving
  // PDF blob:…" to a generic `TypeError: Failed to fetch`. Going Blob →
  // arrayBuffer keeps everything in-process and matches the server-side
  // extractor (services/extract-pdf-text.ts).
  const bytes = new Uint8Array(await pdfFile.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // Worker fetch isn't needed when we hand pdfjs the raw bytes, and skipping
    // it avoids the same blob-URL pitfall in the worker thread.
    useWorkerFetch: false,
    useSystemFonts: true,
  });
  handle.loadingTask = loadingTask as unknown as PdfLoadingTask;
  const pdf = await loadingTask.promise;
  if (handle.cancelled) throw new RenderCancelled();
  const page = await pdf.getPage(pageNumber);
  if (handle.cancelled) throw new RenderCancelled();

  const dpr = window.devicePixelRatio || 1;
  const scale = zoom / 100;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d context unavailable");
  context.scale(dpr, dpr);

  const renderTask = page.render({
    canvasContext: context,
    canvas,
    viewport,
  });
  handle.renderTask = renderTask as unknown as PdfRenderTask;
  await renderTask.promise;

  return {
    width: viewport.width,
    height: viewport.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

class RenderCancelled extends Error {
  constructor() {
    super("Render cancelled");
    this.name = "RenderCancelled";
  }
}

/** Recognise pdfjs's own cancellation rejection alongside our internal one. */
function isCancellationError(err: unknown): boolean {
  if (err instanceof RenderCancelled) return true;
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name?: unknown }).name;
    return name === "RenderingCancelledException";
  }
  return false;
}
