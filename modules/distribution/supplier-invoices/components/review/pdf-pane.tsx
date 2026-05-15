"use client";

import { Link2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";

import { BboxOverlay } from "./bbox-overlay";
import type { LineBbox } from "./line-bbox";
import { PdfCanvas } from "./pdf-canvas";
import type { ParsedLine } from "./types";

/**
 * PDF preview pane. When `pdfFile` is provided the inner canvas is rendered by
 * `pdfjs-dist` and the `BboxOverlay` sits on top as clickable line targets.
 * When `pdfFile` is null/undefined the fake-invoice fallback renders so the
 * surrounding chrome is reviewable before phase 5 wires a real source — the
 * fake invoice keeps its tr-based highlight in that mode.
 */
export function PdfPane({
  fileName,
  page,
  pages,
  zoom,
  onZoom,
  lines,
  activeLineId,
  onLineClick,
  pdfFile,
  lineBboxes,
  paneEnterClass,
}: {
  fileName: string;
  page: number;
  pages: number;
  zoom: number;
  onZoom: (zoom: number) => void;
  lines: ParsedLine[];
  activeLineId: number | null;
  onLineClick: (id: number) => void;
  /** Original PDF bytes. When omitted, the fake-invoice fallback renders. */
  pdfFile?: Blob | null;
  /** Per-line bounding boxes — required for clickable overlays on the real PDF. */
  lineBboxes?: LineBbox[];
  /** Optional CSS class to layer the pane-enter slide animation on. */
  paneEnterClass?: string;
}) {
  // Real PDF canvases are rendered at native CSS size scaled by zoom, so
  // bboxes (in PDF user-space points) need `zoom/100` to align with the canvas.
  // The fake-invoice fallback wraps its content in an outer transform, so
  // bboxes inside that transform stay at 1.0.
  const overlayScale = pdfFile ? zoom / 100 : 1;

  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col", paneEnterClass)}
      style={{ background: "#1a1a1a", borderRight: "1px solid var(--stone-line)" }}
    >
      <PdfToolbar
        fileName={fileName}
        page={page}
        pages={pages}
        zoom={zoom}
        onZoom={onZoom}
      />
      <div
        className="flex flex-1 justify-center overflow-y-auto p-6"
        style={{ alignItems: "flex-start" }}
      >
        {pdfFile ? (
          <PdfCanvas pdfFile={pdfFile} pageNumber={page} zoom={zoom}>
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
        ) : (
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              transition: "transform .15s",
            }}
          >
            <FakeInvoicePage
              lines={lines}
              activeLineId={activeLineId}
              onLineClick={onLineClick}
            />
          </div>
        )}
      </div>
      <PdfHint />
    </div>
  );
}

function PdfToolbar({
  fileName,
  page,
  pages,
  zoom,
  onZoom,
}: {
  fileName: string;
  page: number;
  pages: number;
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  return (
    <div
      className="flex h-[42px] items-center gap-2.5 border-b px-3.5 text-[12px]"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#d4d4d4" }}
    >
      <span
        className="max-w-[180px] truncate font-mono"
        style={{ color: "#9ca3af" }}
      >
        {fileName}
      </span>
      <div className="flex-1" />
      <span style={{ color: "#9ca3af" }}>
        Page {page} / {pages}
      </span>
      <div className="h-[18px] w-px" style={{ background: "#3a3a3a" }} />
      <ToolbarButton onClick={() => onZoom(Math.max(40, zoom - 10))} label="Zoom out">
        <ZoomOut className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
      <span
        className="w-[42px] text-center font-mono"
        style={{ color: "#d4d4d4" }}
      >
        {zoom}%
      </span>
      <ToolbarButton onClick={() => onZoom(Math.min(200, zoom + 10))} label="Zoom in">
        <ZoomIn className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
      <div className="h-[18px] w-px" style={{ background: "#3a3a3a" }} />
      <ToolbarButton onClick={() => onZoom(100)} label="Fit width">
        <Maximize2 className="size-[14px]" strokeWidth={1.6} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-[26px] items-center justify-center rounded-[5px] bg-transparent transition-colors hover:bg-white/10"
      style={{ color: "#d4d4d4" }}
    >
      {children}
    </button>
  );
}

function PdfHint() {
  return (
    <div
      className="flex items-center gap-2.5 border-t px-3.5 py-2 text-[11px]"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#9ca3af" }}
    >
      <Link2 className="size-[14px]" strokeWidth={1.6} />
      Click any row to highlight it in the parsed data →
    </div>
  );
}

function FakeInvoicePage({
  lines,
  activeLineId,
  onLineClick,
}: {
  lines: ParsedLine[];
  activeLineId: number | null;
  onLineClick: (id: number) => void;
}) {
  return (
    <div
      style={{
        width: 680,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: "42px 48px",
        fontFamily: "Times, serif",
        color: "#222",
      }}
    >
      <FakeInvoiceHeader />
      <FakeAddresses />
      <FakeLinesTable
        lines={lines}
        activeLineId={activeLineId}
        onLineClick={onLineClick}
      />
      <FakeTotals total={lines.reduce((s, l) => s + l.total, 0)} />
      <div
        style={{
          marginTop: 36,
          fontSize: 9,
          color: "#888",
          textAlign: "center",
          borderTop: "1px solid #eee",
          paddingTop: 8,
        }}
      >
        Sample invoice rendering · PDF.js replaces this canvas in phase 4
      </div>
    </div>
  );
}

function FakeInvoiceHeader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "#1b3d2f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          ZH
          <br />
          MP
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.005em" }}>
            Zabiha Halal Meat Processors
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>
            1715 W. Cortland Ct Unit 2
          </div>
          <div style={{ fontSize: 11, color: "#444" }}>Addison, IL 60101</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1b3d2f",
            letterSpacing: "-0.01em",
          }}
        >
          INVOICE
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 14, fontSize: 10 }}>
          <div>
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase" }}>Date</div>
            <div style={{ fontWeight: 600, marginTop: 1 }}>04/20/2026</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase" }}>
              Invoice #
            </div>
            <div style={{ fontWeight: 600, marginTop: 1 }}>243192</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FakeAddresses() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 18,
        border: "1px solid #ddd",
      }}
    >
      <div style={{ padding: "8px 12px", borderRight: "1px solid #ddd" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#444" }}>Bill To</div>
        <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
          Acme Distribution LLC
          <br />
          6260 Walnut St
          <br />
          Indianapolis, IN 46227
        </div>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#444" }}>Ship To</div>
        <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>Same</div>
      </div>
    </div>
  );
}

function FakeLinesTable({
  lines,
  activeLineId,
  onLineClick,
}: {
  lines: ParsedLine[];
  activeLineId: number | null;
  onLineClick: (id: number) => void;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
      <thead>
        <tr style={{ background: "#1b3d2f", color: "#fff" }}>
          <th style={{ ...TH, width: 30 }}>#</th>
          <th style={TH}>Description</th>
          <th style={{ ...TH, width: 36, textAlign: "center" }}>Qty</th>
          <th style={{ ...TH, width: 60, textAlign: "right" }}>Wt</th>
          <th style={{ ...TH, width: 50, textAlign: "right" }}>Rate</th>
          <th style={{ ...TH, width: 64, textAlign: "right" }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => {
          const active = activeLineId === line.id;
          const matched = line.match.status === "matched";
          return (
            <tr
              key={line.id}
              onClick={() => onLineClick(line.id)}
              className={cn("pdf-line", active && "active", matched && "matched")}
              style={{ borderBottom: "1px solid #e8e8e8", verticalAlign: "top" }}
            >
              <td style={{ padding: "5px 6px", color: "#666", fontFamily: "var(--font-mono)" }}>
                {i + 1}
              </td>
              <td
                style={{
                  padding: "5px 6px",
                  color: "#222",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  lineHeight: 1.45,
                }}
              >
                {line.raw}
              </td>
              <td
                style={{ padding: "5px 6px", textAlign: "center", fontFamily: "var(--font-mono)" }}
              >
                {line.cases}
              </td>
              <td
                style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)" }}
              >
                {line.weight ? line.weight.toFixed(2) : "—"}
              </td>
              <td
                style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)" }}
              >
                {line.unitPrice.toFixed(2)}
              </td>
              <td
                style={{
                  padding: "5px 6px",
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {line.total.toFixed(2)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FakeTotals({ total }: { total: number }) {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
      <table style={{ fontSize: 10, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px 14px", borderBottom: "1px solid #ddd", color: "#555" }}>
              Subtotal
            </td>
            <td
              style={{
                padding: "4px 0",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
            >
              ${fmt(total)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 14px", borderBottom: "1px solid #ddd", color: "#555" }}>
              Payments
            </td>
            <td
              style={{
                padding: "4px 0",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
              }}
            >
              $0.00
            </td>
          </tr>
          <tr style={{ background: "#1b3d2f", color: "#fff" }}>
            <td style={{ padding: "5px 14px", fontWeight: 600 }}>Total</td>
            <td
              style={{
                padding: "5px 0",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
              }}
            >
              ${fmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: "0.04em",
};
