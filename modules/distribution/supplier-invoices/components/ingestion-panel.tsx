"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/loading/Spinner";
import { ProgressBar } from "@/components/loading/ProgressBar";
import { Skeleton } from "@/components/loading/Skeleton";
import { StageList } from "@/components/loading/StageList";
import { Narration } from "@/components/loading/Narration";
import type { Stage } from "@/components/loading/StageList";
import type { PipelineResult } from "../services/parsing-pipeline";

// ── Design tokens (match mockup exactly) ──────────────────────────────────
const C = {
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
  text3: "var(--color-muted)",
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-default)",
  bg: "var(--color-surface)",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  greenBorder: "var(--color-success-border)",
  amber: "var(--color-warning-fg)",
  amberBg: "var(--color-warning-bg)",
  amberBorder: "var(--color-warning-border)",
  red: "var(--color-danger-fg)",
  redBg: "var(--color-danger-bg)",
  redBorder: "var(--color-danger-border)",
  blue: "var(--color-forest-mid)",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  mono: "var(--font-geist-mono, 'JetBrains Mono', ui-monospace, monospace)",
} as const;

// ── Stage definitions ──────────────────────────────────────────────────────

const STAGE_BASELINE_MS = [300, 1100, 600, 900, 2000, 800, 600]; // upload…reconcile
const STAGE_NAMES = [
  "Upload",
  "Text extraction",
  "Table detection",
  "Line extraction",
  "Product matching",
  "Fee & tax detection",
  "Reconciliation",
];

// Narration lines paired to each active stage
const NARRATION: string[] = [
  "Uploading file to extraction service…",
  "Reading page text · <strong>OCR fallback</strong> if needed",
  "Detecting table boundaries…",
  "Extracting line items from table",
  "Matching products · looking up vendor names in catalog",
  "Scanning for fees, surcharges, and taxes…",
  "Reconciling totals · checking line sum vs invoice total",
];

const SLOW_BASELINE_MS = 8000; // threshold where we flip to "slow" state

// ── Helper: format file size ───────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface IngestionPanelProps {
  fileName: string;
  fileBytes: number;
  isParsing: boolean;
  parseError: Error | null;
  pipelineResult: PipelineResult | null;
  onCancel?: () => void;
  onContinuePartial?: () => void;
  onRetryWithVision?: () => void;
  onAddManually?: () => void;
  onViewPdf?: () => void;
  onDiscard?: () => void;
  onJumpToFirstIssue?: () => void;
}

// ── CHECK / X SVGs ─────────────────────────────────────────────────────────
const CHECK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const X_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Main component ─────────────────────────────────────────────────────────

export function IngestionPanel({
  fileName,
  fileBytes,
  isParsing,
  parseError,
  pipelineResult,
  onCancel,
  onContinuePartial,
  onRetryWithVision,
  onAddManually,
  onViewPdf,
  onDiscard,
  onJumpToFirstIssue,
}: IngestionPanelProps) {
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [stageIdx, setStageIdx] = useState(0); // 0-6, which stage is active
  const [subProgress, setSubProgress] = useState(0);

  // Animate stage progression while parsing
  useEffect(() => {
    if (!isParsing) return;
    startTimeRef.current = Date.now();
    // Reset progress state each time parsing (re)starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsed(0);
    setStageIdx(0);
    setSubProgress(0);

    const tickInterval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);

    // Advance through stages based on cumulative baseline timing
    let cumulative = 0;
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < STAGE_NAMES.length; i++) {
      cumulative += STAGE_BASELINE_MS[i - 1];
      const timeout = setTimeout(() => {
        setStageIdx(i);
        setSubProgress(0);
      }, cumulative);
      stageTimers.push(timeout);
    }

    // Sub-progress animation for product matching (stage 4)
    const matchingStart = STAGE_BASELINE_MS.slice(0, 4).reduce((a, b) => a + b, 0);
    const matchingDuration = STAGE_BASELINE_MS[4];
    const subTick = setInterval(() => {
      const now = Date.now() - startTimeRef.current;
      const matchElapsed = now - matchingStart;
      if (matchElapsed >= 0 && matchElapsed <= matchingDuration) {
        setSubProgress(Math.min(99, (matchElapsed / matchingDuration) * 100));
      }
    }, 100);

    return () => {
      clearInterval(tickInterval);
      clearInterval(subTick);
      stageTimers.forEach(clearTimeout);
    };
  }, [isParsing]);

  // ── Derive state ──────────────────────────────────────────────────────────

  const isSlow = isParsing && elapsed > SLOW_BASELINE_MS;
  const isError = !!parseError;
  const isPartialFailure =
    !isParsing &&
    !isError &&
    pipelineResult !== null &&
    pipelineResult.unresolvedLines.some(l => !l.suggestedProductId);
  const isDone = !isParsing && !isError && pipelineResult !== null;

  const overallPct = isDone
    ? 100
    : Math.min(95, (stageIdx / (STAGE_NAMES.length - 1)) * 80 + (subProgress / 100) * 15);

  const stages: Stage[] = STAGE_NAMES.map((name, i) => ({
    id: String(i),
    name:
      i === 1 && pipelineResult?.requiresOcr ? (
        <span>
          {name}{" "}
          <span style={{ color: C.text3, fontWeight: 400, fontSize: 11 }}>
            · OCR fallback used
          </span>
        </span>
      ) : name,
    status: isDone ? "done" : i < stageIdx ? "done" : i === stageIdx ? "active" : "queued",
    detail: isDone
      ? i === 0 ? "0.3s"
        : i === 1 ? "1.1s"
        : i === 2 ? "0.6s · 1 table"
        : i === 3 ? `0.9s · ${pipelineResult?.prefillResult.values.lines.length ?? "?"} rows`
        : i === 4 ? `${((pipelineResult?.prefillResult.values.lines.length ?? 0) - (pipelineResult?.unresolvedLines.length ?? 0))}/${pipelineResult?.prefillResult.values.lines.length ?? "?"} matched`
        : i === 5 ? `${pipelineResult?.detectedFees.length ?? 0} detected`
        : "done"
      : i < stageIdx
      ? ["0.3s", "1.1s", "0.6s · 1 table", "0.9s"][i] ?? "done"
      : i === stageIdx
      ? i === 4 ? `${Math.round(subProgress / 100 * (pipelineResult?.prefillResult.values.lines.length ?? 9))}/? · matching` : "in progress"
      : "queued",
    subProgress: i === 4 && i === stageIdx ? subProgress : undefined,
  }));

  // ── Header tone ────────────────────────────────────────────────────────────

  const headerGradient = isDone
    ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
    : isError || isPartialFailure
    ? `linear-gradient(135deg, ${C.redBg} 0%, color-mix(in oklch, ${C.redBg} 70%, var(--color-card)) 100%)`
    : isSlow
    ? `linear-gradient(135deg, ${C.amberBg} 0%, color-mix(in oklch, ${C.amberBg} 70%, var(--color-card)) 100%)`
    : "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)";

  const iconBorderColor = isDone
    ? C.green
    : isError || isPartialFailure
    ? C.redBorder
    : isSlow
    ? C.amberBorder
    : C.blueBorder;

  const iconColor = isDone
    ? "var(--color-card)"
    : isError || isPartialFailure
    ? C.red
    : isSlow
    ? C.amber
    : C.blue;

  const iconBg = isDone ? C.green : "transparent";

  const lineCount = pipelineResult?.prefillResult.values.lines.length ?? 0;
  const matchedCount = lineCount - (pipelineResult?.unresolvedLines.length ?? 0);
  const reviewCount = pipelineResult?.unresolvedLines.length ?? 0;
  const feeCount = pipelineResult?.detectedFees.length ?? 0;
  const reconcileGap = pipelineResult?.priceDeviations.reduce((a, b) => a + Math.abs(b.parsedUnitPrice - b.lastUnitPrice), 0) ?? 0;

  // ── Render: State D (partial failure / error) ──────────────────────────────
  if (isError || isPartialFailure) {
    const extractedCount = isError ? 0 : matchedCount;
    const failedCount = isError ? "?" : reviewCount;

    return (
      <div
        style={{
          borderRadius: 14,
          background: "var(--color-card)",
          border: `1px solid ${C.border}`,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", background: headerGradient, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  background: "var(--color-card)",
                  border: `1px solid ${iconBorderColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: iconColor,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.005em" }}>
                  Extracted with issues ·{" "}
                  <span style={{ fontFamily: C.mono }}>{fileName}</span>
                </h3>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>
                  {isError
                    ? parseError?.message ?? "Extraction failed"
                    : `${extractedCount} of ${lineCount} lines extracted · some items need manual review`}
                </div>
              </div>
            </div>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "3px 8px", borderRadius: 5,
                fontSize: 11.5, fontWeight: 600,
                background: C.amberBg, color: C.amber,
              }}
            >
              ⚠ Review before continuing
            </span>
          </div>
        </div>

        {/* Partial grid */}
        <div style={{ padding: "14px 20px", background: "#fefafa", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* What worked */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, background: C.greenBg, color: C.green, display: "flex", alignItems: "center", gap: 6 }}>
                {CHECK} What worked
              </div>
              <ul style={{ margin: 0, padding: "8px 12px 10px 28px", fontSize: 12, color: C.text2 }}>
                {matchedCount > 0 && <li style={{ marginBottom: 3 }}>Supplier and invoice header extracted</li>}
                {matchedCount > 0 && <li style={{ marginBottom: 3 }}>{matchedCount} of {lineCount} lines extracted</li>}
                {feeCount > 0 && <li style={{ marginBottom: 3 }}>{feeCount} fee{feeCount > 1 ? "s" : ""} detected</li>}
                {matchedCount === 0 && <li style={{ marginBottom: 3 }}>File was received and saved</li>}
              </ul>
            </div>
            {/* What didn't */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, background: C.redBg, color: C.red, display: "flex", alignItems: "center", gap: 6 }}>
                {X_ICON} What didn&apos;t
              </div>
              <ul style={{ margin: 0, padding: "8px 12px 10px 28px", fontSize: 12, color: C.text2 }}>
                {isError && <li style={{ marginBottom: 3 }}>Extraction failed: {parseError?.message}</li>}
                {!isError && reviewCount > 0 && (
                  <li style={{ marginBottom: 3 }}>{reviewCount} product{reviewCount > 1 ? "s" : ""} couldn&apos;t be auto-matched</li>
                )}
                {!isError && reconcileGap > 0 && (
                  <li style={{ marginBottom: 3 }}>Reconcile gap of ~${reconcileGap.toFixed(2)} needs review</li>
                )}
                {!isError && reviewCount === 0 && <li style={{ marginBottom: 3 }}>Minor formatting issues may need cleanup</li>}
              </ul>
            </div>
          </div>

          {/* Recovery actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={onContinuePartial}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: "none", background: C.text, color: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
            >
              {CHECK} Continue with {lineCount > 0 ? lineCount : "extracted"} lines
            </button>
            <button
              onClick={onRetryWithVision}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", color: C.text, cursor: "pointer", fontFamily: "inherit" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/></svg>
              Retry with vision model
              <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 600, background: "var(--color-divider)", color: C.text2, marginLeft: 4 }}>+15s</span>
            </button>
            <button
              onClick={onAddManually}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", color: C.text, cursor: "pointer", fontFamily: "inherit" }}
            >
              Add {reviewCount > 0 ? reviewCount : ""} lines manually
            </button>
            <button
              onClick={onViewPdf}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", color: C.text, cursor: "pointer", fontFamily: "inherit" }}
            >
              View PDF →
            </button>
            <button
              onClick={onDiscard}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: "none", background: "transparent", color: C.text, cursor: "pointer", fontFamily: "inherit" }}
            >
              Discard &amp; re-upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: State B (done) ─────────────────────────────────────────────────
  if (isDone) {
    return (
      <div
        style={{
          borderRadius: 14,
          background: "var(--color-card)",
          border: `1px solid ${C.border}`,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ padding: "16px 20px", background: headerGradient, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: iconBg, border: `1px solid ${iconBorderColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: iconColor,
                }}
              >
                {CHECK}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  Done · <span style={{ fontFamily: C.mono }}>{fileName}</span>
                </h3>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>
                  Completed in {fmtElapsed(elapsed)} · scroll to review and resolve {reviewCount} match{reviewCount !== 1 ? "es" : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
              >
                View extraction log
              </button>
              {reviewCount > 0 && (
                <button
                  onClick={onJumpToFirstIssue}
                  style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5, border: "none", background: C.text, color: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Jump to first issue ↓
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            padding: "16px 20px",
            background: "var(--color-page)",
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {[
            { label: "Lines extracted", value: String(lineCount), color: undefined },
            { label: "Auto-matched", value: String(matchedCount), color: C.green },
            { label: "Need review", value: String(reviewCount), color: reviewCount > 0 ? C.amber : undefined },
            { label: "Fees detected", value: String(feeCount), color: undefined },
            { label: "Price alerts", value: String(pipelineResult?.priceDeviations.length ?? 0), color: (pipelineResult?.priceDeviations.length ?? 0) > 0 ? C.amber : undefined },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: "var(--color-card)",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "9px 11px",
              }}
            >
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, color: C.text3 }}>
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: C.mono,
                  marginTop: 2,
                  color: stat.color ?? C.text,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: State A (active) / State C (slow) ──────────────────────────────

  // Stream rows — show skeleton rows for lines not yet streamed
  const totalRows = pipelineResult?.prefillResult.values.lines.length ?? 9;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "var(--color-card)",
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", background: headerGradient, borderBottom: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 20% 30%, rgba(37,99,235,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.08) 0%, transparent 50%)",
            pointerEvents: "none",
          }}
        />
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="loading-pulse-ring"
              style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: "var(--color-card)",
                border: `1px solid ${iconBorderColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: iconColor,
                animation: "loading-pulse-ring 2s infinite",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {isSlow ? "Still working · " : "Processing "}
                <span style={{ fontFamily: C.mono }}>{fileName}</span>
              </h3>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {fmtBytes(fileBytes)} · Scanning…
                {isSlow && (
                  <span style={{ color: C.amber, fontWeight: 500 }}>
                    · {fmtElapsed(elapsed)} elapsed · usually 4–8s for this size
                  </span>
                )}
              </div>
            </div>
          </div>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: 12.5,
              color: C.text2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <strong style={{ color: C.text }}>{fmtElapsed(elapsed)}</strong>
            {" "}elapsed
          </span>
        </div>

        {/* Narration */}
        <Narration
          text={NARRATION[Math.min(stageIdx, NARRATION.length - 1)]}
          micro="live"
          tone={isSlow ? "amber" : "blue"}
        />

        {/* Slow explanation */}
        {isSlow && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.6)",
              border: `1px solid ${C.amberBorder}`,
              borderRadius: 8,
              fontSize: 12,
              color: C.text2,
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong style={{ color: C.text }}>Taking longer than usual.</strong>{" "}
              This may be due to complex table layouts, merged cells, or vision-fallback extraction. We&apos;re still working — partial results will be saved if you cancel.
            </div>
          </div>
        )}

        {/* Overall progress */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.text2, marginBottom: 5, fontVariantNumeric: "tabular-nums" }}>
            <span>Overall progress</span>
            <span style={{ fontFamily: C.mono, fontWeight: 600, color: C.text }}>{Math.round(overallPct)}%</span>
          </div>
          <ProgressBar value={overallPct} color={isSlow ? "amber" : "blue"} />
        </div>
      </div>

      {/* Stages */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10.5, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 10 }}>
          Stages
        </div>
        <StageList stages={stages} />
      </div>

      {/* Streaming results */}
      <div style={{ padding: "16px 20px" }}>
        <div
          style={{
            fontSize: 11,
            color: C.text3,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            className="loading-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.green,
              animation: "loading-pulse 1.5s infinite",
            }}
          />
          Streaming into form · review as it arrives
        </div>

        {/* Skeleton rows for lines not yet extracted */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {Array.from({ length: Math.min(totalRows, 6) }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 60px 80px 80px",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                fontSize: 12.5,
                borderBottom: i < Math.min(totalRows, 6) - 1 ? `1px solid ${C.border}` : undefined,
                background: "var(--color-page)",
              }}
            >
              <div
                style={{
                  width: 18, height: 18,
                  borderRadius: 4,
                  border: `1.5px dashed ${C.borderStrong}`,
                }}
              />
              <Skeleton width="50%" />
              <Skeleton width={40} />
              <Skeleton width={50} />
              <Skeleton width={60} />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          background: "var(--color-page)",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          color: C.text2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          {isSlow
            ? "We'll save partial results if you cancel — you won't lose what's already extracted."
            : "You can start editing matched lines now — extraction will continue in the background."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isSlow && (
            <button
              style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
            >
              Skip page 2
            </button>
          )}
          <button
            style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
            Pause
          </button>
          <button
            onClick={onCancel}
            style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5, border: `1px solid ${C.borderStrong}`, background: "var(--color-card)", cursor: "pointer", fontFamily: "inherit" }}
          >
            {isSlow ? "Cancel & keep partial" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
