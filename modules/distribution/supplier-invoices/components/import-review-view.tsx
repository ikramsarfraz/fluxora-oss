"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Cpu,
  FileText,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  useSaveConfirmedAiAlias,
  useRecordManualProductSelection,
} from "../hooks/use-supplier-invoices";
import type { PipelineResult, UnresolvedLine } from "../services/parsing-pipeline";
import type { ProductListItem } from "@/modules/distribution/products/services/products";
import { filterProducts } from "../utils/parsing-pipeline-logic";
import { CreateProductDialog } from "./create-product-dialog";

// ── Design tokens ──────────────────────────────────────────────────────────
const TK = {
  surface: "#ffffff",
  surfaceAlt: "#f5f5f4",
  surfaceWarn: "oklch(98% 0.02 85)",
  surfaceGood: "oklch(98% 0.015 155)",
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  mutedSoft: "#a8a29e",
  line: "#e7e5e4",
  lineStrong: "#d4d1c7",
  good: "oklch(58% 0.13 155)",
  goodBg: "oklch(95% 0.04 155)",
  goodBorder: "oklch(85% 0.07 155)",
  warn: "oklch(60% 0.14 65)",
  warnBg: "oklch(96% 0.04 85)",
  warnBorder: "oklch(84% 0.08 85)",
  error: "oklch(55% 0.18 27)",
  errorBg: "oklch(97% 0.03 27)",
  errorBorder: "oklch(88% 0.06 27)",
  accent: "oklch(55% 0.18 260)",
  accentBg: "oklch(97% 0.02 260)",
  mono: "var(--font-mono)",
} as const;

// ── Types ──────────────────────────────────────────────────────────────────
type FilterMode = "all" | "needs_review" | "matched" | "ignored";

type LineResolution =
  | { status: "accepted"; productId: string }
  | { status: "chosen"; productId: string }
  | { status: "ignored" };

type Props = {
  pipelineResult: PipelineResult;
  products: ProductListItem[];
  supplierId: string | null;
  onVendorNameResolved: (vendorName: string, productId: string) => void;
  chargesTotal?: number;
  pendingPdfFile?: File | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function confidenceColor(pct: number): string {
  if (pct >= 80) return TK.good;
  if (pct >= 60) return TK.warn;
  return TK.error;
}

function sourceLabel(source: PipelineResult["source"]): string {
  switch (source) {
    case "deterministic": return "Deterministic";
    case "ai_fallback": return "AI text";
    case "hybrid": return "Hybrid";
    case "vision": return "Vision";
  }
}

function SourceIcon({ source }: { source: PipelineResult["source"] }) {
  const style = { width: 12, height: 12 };
  switch (source) {
    case "deterministic": return <FileText style={style} />;
    case "ai_fallback": return <Cpu style={style} />;
    case "hybrid": return <Zap style={style} />;
    case "vision": return <Eye style={style} />;
  }
}

function isInventoryWarning(w: string): boolean {
  const l = w.toLowerCase();
  return !l.includes("fee") && !l.includes("surcharge") && !l.includes("tax") && !l.includes("non-inventory");
}

function isAutoMatched(line: UnresolvedLine): boolean {
  return line.stage !== "unresolved" && !line.aiSuggestionPending;
}

// ── usePaneResize ──────────────────────────────────────────────────────────

const PDF_SNAP_POINTS = [280, 320, 380, 440];
const PDF_MIN_WIDTH = 280;
const PDF_STORAGE_KEY = "bill_form.pdf_pane_width";
const PDF_DEFAULT_WIDTH = 380;

function usePaneResize() {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return PDF_DEFAULT_WIDTH;
    const stored = localStorage.getItem(PDF_STORAGE_KEY);
    if (stored) {
      const v = Number(stored);
      if (v >= PDF_MIN_WIDTH) return v;
    }
    return PDF_DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const liveWidthRef = useRef(width);

  useEffect(() => { liveWidthRef.current = width; }, [width]);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = liveWidthRef.current;
    e.preventDefault();
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      let next = Math.max(PDF_MIN_WIDTH, startWidthRef.current + delta);
      for (const snap of PDF_SNAP_POINTS) {
        if (Math.abs(next - snap) < 14) { next = snap; break; }
      }
      liveWidthRef.current = next;
      setWidth(next);
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      localStorage.setItem(PDF_STORAGE_KEY, String(liveWidthRef.current));
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "[") setCollapsed(true);
      if (e.key === "]") setCollapsed(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { width, collapsed, setCollapsed, onHandleMouseDown };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ConfidenceBadge({ pct }: { pct: number }) {
  const color = confidenceColor(pct);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: TK.mono,
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        flexShrink: 0,
      }}
    >
      {pct}%
    </span>
  );
}

function MathToken({ v, color }: { v: string; color?: string }) {
  return (
    <span
      style={{
        fontFamily: TK.mono,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: 5,
        background: color ? `${color}18` : "#f5f5f4",
        border: `1px solid ${color ? `${color}40` : "#e7e5e4"}`,
        color: color ?? TK.ink,
      }}
    >
      {v}
    </span>
  );
}

function Op({ c }: { c: string }) {
  return (
    <span style={{ fontSize: 12, color: TK.mutedSoft, fontWeight: 600, margin: "0 1px" }}>
      {c}
    </span>
  );
}

function PdfPane({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <iframe
      src={url}
      title="Invoice PDF"
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
    />
  );
}

function StatTile({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const isNum = typeof value !== "string" || !value.startsWith("$");
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "11px 14px",
        background: active ? TK.accentBg : "transparent",
        border: "none",
        borderRight: `1px solid ${TK.line}`,
        borderBottom: active ? `2px solid ${TK.accent}` : "2px solid transparent",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        transition: "background 0.1s",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: TK.mutedSoft,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: color ?? TK.ink,
          fontFamily: !isNum ? TK.mono : "inherit",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </button>
  );
}

function ReconcileBar({
  pdfTotal,
  lineTotal,
  chargesTotal,
  detectedFeeCount,
}: {
  pdfTotal: number;
  lineTotal: number;
  chargesTotal: number;
  detectedFeeCount: number;
}) {
  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formTotal = lineTotal + chargesTotal;
  const gap = pdfTotal - formTotal;
  const isBalanced = Math.abs(gap) < 0.02;

  return (
    <div
      style={{
        padding: "10px 16px",
        background: isBalanced ? "oklch(98% 0.012 155)" : "oklch(98% 0.018 75)",
        borderBottom: `1px solid ${TK.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        {isBalanced ? (
          <CheckCircle2 style={{ width: 12, height: 12, color: TK.good }} />
        ) : (
          <AlertTriangle style={{ width: 12, height: 12, color: TK.warn }} />
        )}
        <span style={{ fontSize: 11, fontWeight: 600, color: isBalanced ? TK.good : TK.warn }}>
          {isBalanced ? "Totals balanced" : `Gap: ${fmt(gap)}`}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: TK.muted }}>PDF</span>
        <MathToken v={fmt(pdfTotal)} />
        <Op c="=" />
        <span style={{ fontSize: 11, color: TK.muted }}>Lines</span>
        <MathToken v={fmt(lineTotal)} />
        <Op c="+" />
        <span style={{ fontSize: 11, color: TK.muted }}>Charges</span>
        <MathToken v={fmt(chargesTotal)} color={chargesTotal > 0 ? TK.good : undefined} />
        <Op c="=" />
        <MathToken v={fmt(formTotal)} color={isBalanced ? TK.good : TK.warn} />
        {isBalanced && <span style={{ fontSize: 11, color: TK.good, fontWeight: 600 }}>✓</span>}
      </div>
      {!isBalanced && (
        <div style={{ marginTop: 6, fontSize: 11, color: TK.ink2 }}>
          {detectedFeeCount > 0
            ? `${detectedFeeCount} fee${detectedFeeCount !== 1 ? "s" : ""} pre-filled — adjust charges to close the ${fmt(gap)} gap.`
            : `Add a charge in the section below to account for the ${fmt(gap)} gap.`}
        </div>
      )}
    </div>
  );
}

function LineReviewCard({
  line,
  products,
  supplierId,
  resolution,
  onAccepted,
  onIgnored,
}: {
  line: UnresolvedLine;
  products: ProductListItem[];
  supplierId: string | null;
  resolution: LineResolution | undefined;
  onAccepted: (productId: string) => void;
  onIgnored: () => void;
}) {
  const [saveAlias, setSaveAlias] = useState(true);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const saveMutation = useSaveConfirmedAiAlias();
  const manualMutation = useRecordManualProductSelection();

  const isBusy = saveMutation.isPending || manualMutation.isPending;

  const filteredProducts = useMemo(
    () => filterProducts(products, query).slice(0, 50),
    [products, query],
  );

  async function accept(productId: string) {
    if (!supplierId) {
      onAccepted(productId);
      return;
    }
    try {
      if (saveAlias) {
        await saveMutation.mutateAsync({
          supplierId,
          vendorProductName: line.vendorProductName,
          internalProductId: productId,
        });
      } else {
        await manualMutation.mutateAsync({
          supplierId,
          vendorProductName: line.vendorProductName,
          internalProductId: productId,
        });
      }
      const prod = products.find(p => p.id === productId);
      toast.success(
        saveAlias
          ? `Alias saved: "${line.vendorProductName}" → "${prod?.name ?? productId}"`
          : `Matched: "${line.vendorProductName}" → "${prod?.name ?? productId}"`,
      );
      onAccepted(productId);
    } catch {
      toast.error("Could not save.");
    }
  }

  // ── Auto-matched (pipeline resolved, no user action needed) ───────────
  if (isAutoMatched(line) && !resolution) {
    const autoProduct = line.suggestedProductId
      ? products.find(p => p.id === line.suggestedProductId)
      : null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 0",
          borderBottom: `1px solid ${TK.line}`,
        }}
      >
        <CheckCircle2 style={{ width: 13, height: 13, color: TK.good, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: TK.mono,
            fontSize: 12,
            fontWeight: 500,
            color: TK.ink2,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {line.vendorProductName}
        </span>
        <span style={{ fontSize: 11, color: TK.mutedSoft }}>→</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TK.ink,
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {autoProduct?.name ?? line.suggestedProductId}
        </span>
        <ConfidenceBadge pct={line.confidence} />
      </div>
    );
  }

  // ── User resolved ─────────────────────────────────────────────────────
  if (resolution?.status === "accepted" || resolution?.status === "chosen") {
    const prod = products.find(p => p.id === resolution.productId);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 0",
          borderBottom: `1px solid ${TK.line}`,
          opacity: 0.75,
        }}
      >
        <CheckCircle2 style={{ width: 13, height: 13, color: TK.good, flexShrink: 0 }} />
        <span style={{ fontFamily: TK.mono, fontSize: 12, color: TK.ink2 }}>
          {line.vendorProductName}
        </span>
        <span style={{ fontSize: 11, color: TK.mutedSoft }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: TK.good }}>
          {prod?.name ?? resolution.productId}
        </span>
        <span style={{ fontSize: 11, color: TK.mutedSoft, marginLeft: 2 }}>· saved</span>
      </div>
    );
  }

  // ── User ignored ──────────────────────────────────────────────────────
  if (resolution?.status === "ignored") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 0",
          borderBottom: `1px solid ${TK.line}`,
          opacity: 0.45,
        }}
      >
        <XCircle style={{ width: 13, height: 13, color: TK.mutedSoft, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: TK.mono,
            fontSize: 12,
            color: TK.muted,
            textDecoration: "line-through",
          }}
        >
          {line.vendorProductName}
        </span>
        <span style={{ fontSize: 11, color: TK.mutedSoft }}>ignored</span>
      </div>
    );
  }

  // ── Needs review ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: "11px 0", borderBottom: `1px solid ${TK.line}` }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <AlertTriangle
          style={{ width: 13, height: 13, color: TK.warn, marginTop: 1, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: TK.mono,
            fontSize: 12,
            fontWeight: 600,
            color: TK.ink,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {line.vendorProductName}
        </span>
        <button
          type="button"
          onClick={onIgnored}
          disabled={isBusy}
          style={ghostBtnSm}
        >
          Ignore
        </button>
      </div>

      {/* Top 3 suggestion chips */}
      {line.topCandidates && line.topCandidates.length > 0 ? (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {line.topCandidates.slice(0, 3).map(c => (
            <button
              key={c.id}
              type="button"
              disabled={isBusy}
              onClick={() => accept(c.id)}
              style={chipStyle(isBusy)}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {c.name}
              </span>
              <ConfidenceBadge pct={c.score} />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: TK.mutedSoft, marginBottom: 8 }}>
          No candidates found
        </div>
      )}

      {/* Alias checkbox + search toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          id={`alias-${line.vendorProductName}`}
          checked={saveAlias}
          onChange={e => setSaveAlias(e.target.checked)}
          style={{ width: 12, height: 12, cursor: "pointer", accentColor: TK.accent }}
        />
        <label
          htmlFor={`alias-${line.vendorProductName}`}
          style={{ fontSize: 11, color: TK.muted, cursor: "pointer" }}
        >
          Remember alias
        </label>
        <button
          type="button"
          onClick={() => {
            setSearching(s => !s);
            if (creating) setCreating(false);
          }}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: TK.accent,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          <Search style={{ width: 10, height: 10 }} />
          Search all
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: TK.accent,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          + Create new
        </button>
      </div>

      {/* Full product-creation form in a modal — same fields as Settings →
          Products, so the new product is immediately usable for receiving,
          pricing, and order fulfilment. Vendor text prefills the name. */}
      <CreateProductDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={line.vendorProductName}
        onCreated={productId => {
          void accept(productId);
        }}
      />

      {/* Product search */}
      {searching && (
        <div style={{ marginTop: 8 }}>
          <div style={{ position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                width: 12,
                height: 12,
                color: TK.mutedSoft,
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or SKU…"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px 6px 28px",
                fontSize: 12,
                border: `1px solid ${TK.lineStrong}`,
                borderRadius: 6,
                background: TK.surface,
                color: TK.ink,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              border: `1px solid ${TK.line}`,
              borderRadius: 6,
              marginTop: 4,
            }}
          >
            {filteredProducts.length === 0 ? (
              <div
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: TK.mutedSoft,
                  textAlign: "center",
                }}
              >
                No products found
              </div>
            ) : (
              filteredProducts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "7px 12px",
                    background: selectedId === p.id ? TK.accentBg : "transparent",
                    border: "none",
                    borderBottom: `1px solid ${TK.line}`,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: TK.ink,
                      fontWeight: selectedId === p.id ? 600 : 400,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  {p.sku && (
                    <span
                      style={{ fontSize: 11, color: TK.mutedSoft, fontFamily: TK.mono, flexShrink: 0 }}
                    >
                      {p.sku}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {selectedId && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => accept(selectedId)}
                disabled={isBusy}
                style={primaryBtnSm(isBusy)}
              >
                {saveAlias ? "Save alias" : "Select"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ImportReviewView({
  pipelineResult,
  products,
  supplierId,
  onVendorNameResolved,
  chargesTotal = 0,
  pendingPdfFile,
}: Props) {
  const { width: pdfWidth, collapsed, setCollapsed, onHandleMouseDown } = usePaneResize();
  const [handleHovered, setHandleHovered] = useState(false);
  const [resolutions, setResolutions] = useState<Map<string, LineResolution>>(new Map());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  const {
    prefillResult,
    confidence,
    source,
    visionUsed,
    aiUsed,
    unresolvedLines,
    detectedFees,
    priceDeviations,
    warnings,
  } = pipelineResult;

  const { totalComparison } = prefillResult;
  const lineCount = prefillResult.values.lines.length;
  const pdfTotal = Number(totalComparison.extractedTotal ?? 0);
  const lineTotal = Number(totalComparison.computedLineTotal ?? 0);

  const needsReviewLines = unresolvedLines.filter(
    l => !isAutoMatched(l) && !resolutions.has(l.vendorProductName),
  );
  const matchedLines = unresolvedLines.filter(l => {
    const r = resolutions.get(l.vendorProductName);
    return isAutoMatched(l) || r?.status === "accepted" || r?.status === "chosen";
  });
  const ignoredLines = unresolvedLines.filter(
    l => resolutions.get(l.vendorProductName)?.status === "ignored",
  );

  const displayedLines: UnresolvedLine[] = (() => {
    switch (filterMode) {
      case "needs_review": return needsReviewLines;
      case "matched": return matchedLines;
      case "ignored": return ignoredLines;
      default: return unresolvedLines;
    }
  })();

  const inventoryWarnings = warnings.filter(isInventoryWarning);
  const visibleWarnings = inventoryWarnings.filter(w => !dismissedWarnings.has(w));

  const showReconcile = !!totalComparison.extractedTotal && totalComparison.matches !== true;
  const totalsMatch = totalComparison.matches;

  function handleAccepted(line: UnresolvedLine, productId: string) {
    setResolutions(m => new Map(m).set(line.vendorProductName, { status: "accepted", productId }));
    onVendorNameResolved(line.vendorProductName, productId);
  }

  function handleIgnored(line: UnresolvedLine) {
    setResolutions(m => new Map(m).set(line.vendorProductName, { status: "ignored" }));
  }

  const tabs: [FilterMode, string, number][] = [
    ["all", "All", unresolvedLines.length],
    ["needs_review", "Needs review", needsReviewLines.length],
    ["matched", "Matched", matchedLines.length],
    ...(ignoredLines.length > 0 ? [["ignored", "Ignored", ignoredLines.length] as [FilterMode, string, number]] : []),
  ];

  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${TK.line}`,
        borderRadius: 12,
        overflow: "hidden",
        background: TK.surface,
      }}
    >
      {/* ── PDF pane (rail or full) ──────────────────────────────────────── */}
      {pendingPdfFile && (
        <>
          {collapsed ? (
            /* Rail: 48px collapsed strip with vertical filename */
            <div
              style={{
                width: 48,
                flexShrink: 0,
                borderRight: `1px solid ${TK.line}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "sticky",
                top: 72,
                height: "calc(100vh - 110px)",
                alignSelf: "flex-start",
                background: TK.surfaceAlt,
              }}
            >
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title="Expand PDF pane (])"
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 8,
                  borderRadius: 6,
                  background: "transparent",
                  border: `1px solid ${TK.line}`,
                  cursor: "pointer",
                  color: TK.muted,
                  flexShrink: 0,
                  fontFamily: "inherit",
                }}
              >
                <ChevronRight style={{ width: 13, height: 13 }} />
              </button>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  padding: "8px 0",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: TK.mutedSoft,
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxHeight: "100%",
                  }}
                >
                  {prefillResult.sourceFilename}
                </span>
              </div>
            </div>
          ) : (
            /* Full pane */
            <div
              style={{
                width: pdfWidth,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                position: "sticky",
                top: 72,
                height: "calc(100vh - 110px)",
                alignSelf: "flex-start",
              }}
            >
              <div
                style={{
                  padding: "9px 12px",
                  background: TK.surfaceAlt,
                  borderBottom: `1px solid ${TK.line}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <FileText style={{ width: 11, height: 11, color: TK.mutedSoft }} />
                <span
                  style={{
                    fontSize: 11,
                    color: TK.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {prefillResult.sourceFilename}
                </span>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Collapse PDF pane ([)"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: "transparent",
                    border: `1px solid ${TK.line}`,
                    cursor: "pointer",
                    color: TK.mutedSoft,
                    flexShrink: 0,
                    fontFamily: "inherit",
                  }}
                >
                  <ChevronLeft style={{ width: 12, height: 12 }} />
                </button>
              </div>
              <div style={{ flex: 1, background: "#e5e5e5", overflow: "hidden" }}>
                <PdfPane file={pendingPdfFile} />
              </div>
            </div>
          )}

          {/* Drag handle (only when expanded) */}
          {!collapsed && (
            <div
              onMouseDown={onHandleMouseDown}
              onMouseEnter={() => setHandleHovered(true)}
              onMouseLeave={() => setHandleHovered(false)}
              style={{
                width: 6,
                flexShrink: 0,
                cursor: "col-resize",
                background: handleHovered ? `${TK.accent}18` : "transparent",
                borderRight: `1px solid ${TK.line}`,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.12s",
                zIndex: 10,
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 32,
                  borderRadius: 2,
                  background: handleHovered ? TK.accent : TK.lineStrong,
                  transition: "background 0.12s",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </>
      )}

      {/* ── Review pane ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div
          style={{
            padding: "11px 16px",
            background: TK.surfaceAlt,
            borderBottom: `1px solid ${TK.line}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: TK.ink,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Import review
          </span>
          <span style={{ width: 1, height: 14, background: TK.lineStrong }} />
          <span
            style={{
              fontSize: 11,
              color: TK.muted,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <SourceIcon source={source} />
            {sourceLabel(source)}
          </span>
          <ConfidenceBadge pct={confidence} />
          {visionUsed && (
            <span
              style={{
                fontSize: 11,
                color: TK.accent,
                background: TK.accentBg,
                border: `1px solid ${TK.accent}33`,
                borderRadius: 99,
                padding: "2px 7px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Eye style={{ width: 10, height: 10 }} />
              Vision
            </span>
          )}
          {aiUsed && !visionUsed && (
            <span
              style={{
                fontSize: 11,
                color: TK.muted,
                background: TK.surfaceAlt,
                border: `1px solid ${TK.line}`,
                borderRadius: 99,
                padding: "2px 7px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Cpu style={{ width: 10, height: 10 }} />
              AI
            </span>
          )}
        </div>

        {/* Stat tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
            borderBottom: `1px solid ${TK.line}`,
          }}
        >
          <StatTile
            label="Rows"
            value={lineCount}
            color={lineCount > 0 ? TK.good : TK.error}
            active={filterMode === "all"}
            onClick={() => setFilterMode("all")}
          />
          <StatTile
            label="Matched"
            value={matchedLines.length}
            color={matchedLines.length > 0 ? TK.good : TK.muted}
            active={filterMode === "matched"}
            onClick={() => setFilterMode(filterMode === "matched" ? "all" : "matched")}
          />
          <StatTile
            label="Needs review"
            value={needsReviewLines.length}
            color={needsReviewLines.length > 0 ? TK.warn : TK.good}
            active={filterMode === "needs_review"}
            onClick={() => setFilterMode(filterMode === "needs_review" ? "all" : "needs_review")}
          />
          {totalComparison.extractedTotal ? (
            <>
              <StatTile
                label="PDF total"
                value={`$${pdfTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                color={TK.ink}
              />
              <StatTile
                label="Line subtotal"
                value={`$${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                color={
                  totalsMatch === true ? TK.good : totalsMatch === false ? TK.warn : TK.ink
                }
              />
            </>
          ) : null}
          {detectedFees.length > 0 && (
            <StatTile
              label="Fees"
              value={detectedFees.length}
              color={TK.warn}
            />
          )}
        </div>

        {/* Reconcile bar */}
        {showReconcile && (
          <ReconcileBar
            pdfTotal={pdfTotal}
            lineTotal={lineTotal}
            chargesTotal={chargesTotal}
            detectedFeeCount={detectedFees.length}
          />
        )}

        {/* Warnings */}
        {visibleWarnings.length > 0 && (
          <div
            style={{
              padding: "10px 16px",
              borderBottom: `1px solid ${TK.line}`,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {visibleWarnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "7px 10px",
                  background: TK.warnBg,
                  border: `1px solid ${TK.warnBorder}`,
                  borderRadius: 7,
                }}
              >
                <AlertTriangle
                  style={{ width: 12, height: 12, color: TK.warn, flexShrink: 0, marginTop: 1 }}
                />
                <span style={{ fontSize: 12, color: TK.ink2, flex: 1, lineHeight: 1.5 }}>{w}</span>
                <button
                  type="button"
                  onClick={() => setDismissedWarnings(s => new Set(s).add(w))}
                  style={{
                    fontSize: 11,
                    color: TK.mutedSoft,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {unresolvedLines.length > 0 && (
          <div
            style={{
              padding: "0 16px",
              borderBottom: `1px solid ${TK.line}`,
              display: "flex",
              gap: 0,
            }}
          >
            {tabs.map(([mode, label, count]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: filterMode === mode ? 600 : 400,
                  color: filterMode === mode ? TK.ink : TK.muted,
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${filterMode === mode ? TK.ink : "transparent"}`,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: -1,
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: filterMode === mode ? TK.ink : TK.line,
                      color: filterMode === mode ? "#fff" : TK.muted,
                      borderRadius: 99,
                      padding: "1px 5px",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Line review cards */}
        <div style={{ padding: "0 16px" }}>
          {displayedLines.length === 0 ? (
            <div
              style={{
                padding: "20px 0",
                textAlign: "center",
                fontSize: 12,
                color: TK.mutedSoft,
              }}
            >
              {filterMode === "needs_review"
                ? "All lines resolved"
                : filterMode === "matched"
                  ? "No matched lines yet"
                  : filterMode === "ignored"
                    ? "No ignored lines"
                    : "No lines to review"}
            </div>
          ) : (
            displayedLines.map((line, i) => (
              <LineReviewCard
                key={`${line.vendorProductName}-${i}`}
                line={line}
                products={products}
                supplierId={supplierId}
                resolution={resolutions.get(line.vendorProductName)}
                onAccepted={productId => handleAccepted(line, productId)}
                onIgnored={() => handleIgnored(line)}
              />
            ))
          )}
        </div>

        {/* Price deviations */}
        {priceDeviations.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${TK.line}` }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: TK.mutedSoft,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              Price changes vs last invoice
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {priceDeviations.map(d => {
                const up = d.deviationPct > 0;
                const pct = Math.abs(d.deviationPct).toFixed(1);
                const color = up ? TK.error : TK.good;
                const fmt = (v: number) =>
                  `$${v.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
                return (
                  <div
                    key={d.productId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: up ? TK.errorBg : TK.goodBg,
                      border: `1px solid ${up ? TK.errorBorder : TK.goodBorder}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: TK.ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.productName}
                      </div>
                      <div style={{ fontSize: 11, color: TK.muted, marginTop: 1 }}>
                        Last: {fmt(d.lastUnitPrice)} · {d.lastInvoiceDate}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: TK.mono,
                        color,
                        background: `${color}22`,
                        border: `1px solid ${color}44`,
                        borderRadius: 99,
                        padding: "1px 7px",
                        flexShrink: 0,
                      }}
                    >
                      {up ? "+" : "−"}{pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detected fees */}
        {detectedFees.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderTop: `1px solid ${TK.line}`,
              background: TK.warnBg,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: TK.warn,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 7,
              }}
            >
              Additional charges (excluded from inventory)
            </div>
            {detectedFees.map((fee, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: TK.ink2,
                  marginBottom: 3,
                }}
              >
                <span>{fee.description}</span>
                {fee.amount > 0 && (
                  <span style={{ fontFamily: TK.mono, fontWeight: 600, color: TK.ink }}>
                    ${fee.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Button style helpers ───────────────────────────────────────────────────

const ghostBtnSm: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 400,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "transparent",
  color: TK.muted,
  border: `1px solid ${TK.line}`,
  flexShrink: 0,
};

function chipStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    background: TK.accentBg,
    color: TK.ink,
    border: `1px solid ${TK.accent}44`,
    maxWidth: 260,
  };
}

function primaryBtnSm(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    background: TK.ink,
    color: "#fff",
    border: "none",
  };
}
