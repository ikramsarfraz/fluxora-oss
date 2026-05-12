"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Eye, Cpu, FileText, Keyboard, Zap, Search } from "lucide-react";
import { toast } from "sonner";

import {
  useSaveConfirmedAiAlias,
  useRecordManualProductSelection,
  useCreateImportProfile,
} from "../hooks/use-supplier-invoices";
import type { PipelineResult, UnresolvedLine } from "../services/parsing-pipeline";
import type { ProductListItem } from "@/modules/distribution/products/services/products";
import { countBlockingUnresolved, filterProducts } from "../utils/parsing-pipeline-logic";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
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

type RowState = "pending" | "accepted" | "chosen" | "ignored" | "choosing";

type UnresolvedRowHandle = {
  acceptSuggestion: () => void;
  chooseByIndex: (n: number) => void;
  ignore: () => void;
};

type Props = {
  pipelineResult: PipelineResult;
  products: ProductListItem[];
  supplierId: string | null;
  onVendorNameResolved: (vendorName: string, productId: string) => void;
  /** Live sum of all charges currently entered in the form — used for reconcile widget. */
  chargesTotal?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function confidenceColor(pct: number): string {
  if (pct >= 80) return C.good;
  if (pct >= 60) return C.warn;
  return C.error;
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

function isInventoryWarning(warning: string): boolean {
  const lower = warning.toLowerCase();
  return (
    !lower.includes("fee") &&
    !lower.includes("surcharge") &&
    !lower.includes("tax") &&
    !lower.includes("non-inventory")
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: C.mutedSoft,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: color ?? C.ink,
          fontFamily: typeof value === "string" && /^\$/.test(value) ? C.mono : "inherit",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ConfidenceBadge({ pct }: { pct: number }) {
  const color = confidenceColor(pct);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: C.mono,
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {pct}%
    </span>
  );
}

const STAGE_LABELS: Record<string, string> = {
  exact_alias: "alias",
  normalized_alias: "alias",
  exact_product: "exact",
  fuzzy_product: "fuzzy",
  ai_suggested: "AI",
};

function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage];
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: C.mutedSoft,
        padding: "1px 5px",
        border: `1px solid ${C.line}`,
        borderRadius: 4,
        lineHeight: 1.6,
      }}
    >
      {label}
    </span>
  );
}

const UnresolvedRow = forwardRef<
  UnresolvedRowHandle,
  {
    line: UnresolvedLine;
    products: ProductListItem[];
    supplierId: string | null;
    onResolved: (productId: string, how: "accepted_ai" | "manual") => void;
    onIgnored: () => void;
    saveMutation: ReturnType<typeof useSaveConfirmedAiAlias>;
    manualMutation: ReturnType<typeof useRecordManualProductSelection>;
    focused?: boolean;
  }
>(function UnresolvedRow(
  { line, products, supplierId, onResolved, onIgnored, saveMutation, manualMutation, focused = false },
  ref,
) {
  const [rowState, setRowState] = useState<RowState>("pending");
  const [chosenProductId, setChosenProductId] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const filteredProducts = useMemo(
    () => filterProducts(products, query).slice(0, 50),
    [products, query],
  );

  const hasSuggestion =
    line.suggestedProductId !== null && (line.aiSuggestionPending || line.stage === "ai_suggested");

  const suggestedProduct = hasSuggestion
    ? products.find(p => p.id === line.suggestedProductId)
    : null;

  async function handleAccept() {
    if (!line.suggestedProductId || !supplierId) return;
    try {
      await saveMutation.mutateAsync({
        supplierId,
        vendorProductName: line.vendorProductName,
        internalProductId: line.suggestedProductId,
      });
      setRowState("accepted");
      onResolved(line.suggestedProductId, "accepted_ai");
      toast.success(`Alias saved: "${line.vendorProductName}" → "${suggestedProduct?.name ?? line.suggestedProductId}"`);
    } catch {
      toast.error("Could not save alias.");
    }
  }

  async function handleChooseById(id: string) {
    if (!id || !supplierId) return;
    try {
      await manualMutation.mutateAsync({
        supplierId,
        vendorProductName: line.vendorProductName,
        internalProductId: id,
      });
      const prod = products.find(p => p.id === id);
      setChosenProductId(id);
      setRowState("chosen");
      onResolved(id, "manual");
      toast.success(`Alias saved: "${line.vendorProductName}" → "${prod?.name ?? id}"`);
    } catch {
      toast.error("Could not save alias.");
    }
  }

  function cancelChoosing() {
    setRowState("pending");
    setQuery("");
    setChosenProductId("");
  }

  const isBusy = saveMutation.isPending || manualMutation.isPending;

  useImperativeHandle(ref, () => ({
    acceptSuggestion: handleAccept,
    chooseByIndex: (n: number) => {
      const candidate = line.topCandidates?.[n];
      if (candidate) handleChooseById(candidate.id);
    },
    ignore: () => {
      setRowState("ignored");
      onIgnored();
    },
  }));

  if (rowState === "accepted" || rowState === "chosen") {
    const finalProductId = rowState === "accepted" ? line.suggestedProductId! : chosenProductId;
    const finalProduct = products.find(p => p.id === finalProductId);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          borderBottom: `1px solid ${C.line}`,
          opacity: 0.7,
        }}
      >
        <CheckCircle2 style={{ width: 14, height: 14, color: C.good, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>
          <span style={{ fontWeight: 500, color: C.ink2 }}>{line.vendorProductName}</span>
          {" → "}
          <span style={{ fontWeight: 500, color: C.good }}>{finalProduct?.name ?? finalProductId}</span>
          {" "}
          <span style={{ color: C.mutedSoft }}>· alias saved</span>
        </span>
      </div>
    );
  }

  if (rowState === "ignored") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          borderBottom: `1px solid ${C.line}`,
          opacity: 0.5,
        }}
      >
        <XCircle style={{ width: 14, height: 14, color: C.mutedSoft, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: C.muted }}>
          <span style={{ fontWeight: 500 }}>{line.vendorProductName}</span>
          {" · ignored — select a product in the line editor below, or remove this line"}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: hasSuggestion || rowState === "choosing" ? 8 : 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {line.vendorProductName}
          </div>
          {hasSuggestion && suggestedProduct && (
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: C.mutedSoft }}>→</span>
              <span style={{ fontWeight: 500, color: C.ink2 }}>{suggestedProduct.name}</span>
              <ConfidenceBadge pct={line.confidence} />
              <StageBadge stage={line.stage} />
            </div>
          )}
          {!hasSuggestion && (
            <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>
              No match found
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {hasSuggestion && rowState === "pending" && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={isBusy}
              style={smallPrimaryBtn(isBusy)}
            >
              Accept
            </button>
          )}
          {rowState === "pending" && (
            <button
              type="button"
              onClick={() => setRowState("choosing")}
              disabled={isBusy}
              style={smallSecondaryBtn(isBusy)}
            >
              {hasSuggestion ? "Choose different" : "Choose product"}
            </button>
          )}
          {rowState === "choosing" && (
            <button
              type="button"
              onClick={cancelChoosing}
              style={smallGhostBtn}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => { setRowState("ignored"); onIgnored(); }}
            disabled={isBusy}
            style={smallGhostBtn}
          >
            Ignore
          </button>
        </div>
      </div>

      {/* Searchable product chooser */}
      {rowState === "choosing" && (
        <div style={{ marginTop: 8 }}>
          {/* Top candidates one-click chips */}
          {line.topCandidates && line.topCandidates.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.mutedSoft,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                AI suggestions — click to save immediately
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {line.topCandidates.map((c, ci) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleChooseById(c.id)}
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 9px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: "inherit",
                      cursor: isBusy ? "not-allowed" : "pointer",
                      opacity: isBusy ? 0.6 : 1,
                      background: C.accentBg,
                      color: C.ink,
                      border: `1px solid ${C.accent}44`,
                    }}
                  >
                    {focused && ci < 3 && (
                      <span style={{
                        position: "absolute",
                        top: -7,
                        left: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.accent,
                        background: C.surface,
                        padding: "0 2px",
                        borderRadius: 2,
                        lineHeight: 1.4,
                        pointerEvents: "none",
                      }}>
                        {ci + 1}
                      </span>
                    )}
                    {c.name}
                    <ConfidenceBadge pct={c.score} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <Search
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                width: 12,
                height: 12,
                color: C.mutedSoft,
                pointerEvents: "none",
                flexShrink: 0,
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
                border: `1px solid ${C.lineStrong}`,
                borderRadius: 6,
                background: C.surface,
                color: C.ink,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Filtered product list */}
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {filteredProducts.length === 0 ? (
              <div
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: C.mutedSoft,
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
                  onClick={() => setChosenProductId(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "7px 12px",
                    background: chosenProductId === p.id ? C.accentBg : "transparent",
                    border: "none",
                    borderBottom: `1px solid ${C.line}`,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: C.ink,
                      fontWeight: chosenProductId === p.id ? 600 : 400,
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
                      style={{
                        fontSize: 11,
                        color: C.mutedSoft,
                        fontFamily: C.mono,
                        flexShrink: 0,
                      }}
                    >
                      {p.sku}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Save action */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => handleChooseById(chosenProductId)}
              disabled={!chosenProductId || isBusy}
              style={smallPrimaryBtn(!chosenProductId || isBusy)}
            >
              Save alias
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Reconcile widget ───────────────────────────────────────────────────────

function ReconcileWidget({
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

  const TokMono = ({ v, color }: { v: string; color?: string }) => (
    <span
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 5,
        background: color ? `${color}18` : "#f5f5f4",
        border: `1px solid ${color ? `${color}40` : "#e7e5e4"}`,
        color: color ?? C.ink,
      }}
    >
      {v}
    </span>
  );

  const Op = ({ c }: { c: string }) => (
    <span style={{ fontSize: 12, color: C.mutedSoft, fontWeight: 600, margin: "0 2px" }}>{c}</span>
  );

  return (
    <div
      style={{
        margin: "0 0",
        padding: "12px 20px",
        borderBottom: `1px solid ${C.line}`,
        background: isBalanced ? "oklch(98% 0.012 155)" : "oklch(98% 0.018 75)",
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: isBalanced ? C.good : C.warn,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {isBalanced ? (
            <CheckCircle2 style={{ width: 13, height: 13 }} />
          ) : (
            <AlertTriangle style={{ width: 13, height: 13 }} />
          )}
          {isBalanced ? "Totals balanced — charges account for the gap" : "Totals mismatch"}
        </span>
        {!isBalanced && (
          <span
            style={{
              fontFamily: C.mono,
              fontSize: 12,
              fontWeight: 700,
              color: C.warn,
            }}
          >
            Gap: {fmt(gap)}
          </span>
        )}
      </div>

      {/* Math equation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <span style={{ fontSize: 11, color: C.muted }}>PDF total</span>
        <TokMono v={fmt(pdfTotal)} />
        <Op c="=" />
        <span style={{ fontSize: 11, color: C.muted }}>Lines</span>
        <TokMono v={fmt(lineTotal)} />
        <Op c="+" />
        <span style={{ fontSize: 11, color: C.muted }}>Charges</span>
        <TokMono
          v={fmt(chargesTotal)}
          color={chargesTotal > 0 ? C.good : undefined}
        />
        <Op c="=" />
        <TokMono
          v={fmt(formTotal)}
          color={isBalanced ? C.good : C.warn}
        />
        {isBalanced && (
          <span style={{ fontSize: 11, color: C.good, fontWeight: 600 }}>✓</span>
        )}
      </div>

      {/* Hint when still unbalanced */}
      {!isBalanced && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.ink2, lineHeight: 1.5 }}>
          {detectedFeeCount > 0
            ? `${detectedFeeCount} fee${detectedFeeCount !== 1 ? "s" : ""} were detected and pre-filled in the charges section below — adjust or add charges to close the ${fmt(gap)} gap.`
            : `The remaining ${fmt(gap)} may be a delivery charge, fee, or missing line. Add it in the charges section below.`}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ImportReviewPanel({
  pipelineResult,
  products,
  supplierId,
  onVendorNameResolved,
  chargesTotal = 0,
}: Props) {
  const [warningsExpanded, setWarningsExpanded] = useState(true);
  const [unresolvedExpanded, setUnresolvedExpanded] = useState(true);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileDismissed, setProfileDismissed] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [resolutionSummary, setResolutionSummary] = useState({
    acceptedAiSuggestion: 0,
    manuallyMatched: 0,
    ignoredByUser: 0,
  });

  const saveAliasMutation = useSaveConfirmedAiAlias();
  const manualMutation = useRecordManualProductSelection();
  const createProfileMutation = useCreateImportProfile();

  const [priceChangesExpanded, setPriceChangesExpanded] = useState(true);
  const [focusedIndex, setFocusedIndexState] = useState<number | null>(null);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);

  // Refs so the keydown handler always sees fresh values without re-registering
  const focusedIndexRef = useRef<number | null>(null);
  const rowRefs = useRef<(UnresolvedRowHandle | null)[]>([]);
  const rowElRefs = useRef<(HTMLDivElement | null)[]>([]);
  const actionableUnresolvedLenRef = useRef(0);

  function setFocusedIndex(v: number | null) {
    focusedIndexRef.current = v;
    setFocusedIndexState(v);
  }

  const {
    prefillResult,
    confidence,
    source,
    visionUsed,
    aiUsed,
    unresolvedLines,
    detectedFees,
    priceDeviations,
    proposedProfile,
    warnings,
    confidenceBreakdown,
  } = pipelineResult;

  const { totalComparison } = prefillResult;
  const lineCount = prefillResult.values.lines.length;

  const actionableUnresolved = unresolvedLines.filter(
    l => l.stage === "unresolved" || l.aiSuggestionPending,
  );
  const matchedCount = unresolvedLines.filter(
    l => l.stage !== "unresolved" && !l.aiSuggestionPending,
  ).length;

  // Option B: ignored rows still count as blocking — they need manual product
  // selection in the line editor or removal before the invoice can be posted.
  const blockingCount = countBlockingUnresolved(actionableUnresolved.length, resolvedCount, 0);

  const inventoryWarnings = warnings.filter(isInventoryWarning);

  const totalsMatch = totalComparison.matches;
  const totalsOk = totalsMatch === true;
  const totalsMismatch = totalsMatch === false;

  const hasFees = detectedFees.length > 0;

  // Keep len ref in sync so the single keydown handler always reads the current length
  actionableUnresolvedLenRef.current = actionableUnresolved.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as Element;
      // Don't intercept when user is typing
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsVisible(v => !v);
        return;
      }

      const len = actionableUnresolvedLenRef.current;
      if (len === 0) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const next = focusedIndexRef.current === null ? 0 : Math.min(focusedIndexRef.current + 1, len - 1);
        setFocusedIndex(next);
        setUnresolvedExpanded(true);
        rowElRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (focusedIndexRef.current === null) return;
        const prev = Math.max(0, focusedIndexRef.current - 1);
        setFocusedIndex(prev);
        rowElRefs.current[prev]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }

      const idx = focusedIndexRef.current;
      if (idx === null) return;

      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        rowRefs.current[idx]?.chooseByIndex(Number(e.key) - 1);
        // Advance focus to next pending row
        if (idx + 1 < len) setFocusedIndex(idx + 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        rowRefs.current[idx]?.acceptSuggestion();
        if (idx + 1 < len) setFocusedIndex(idx + 1);
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        rowRefs.current[idx]?.ignore();
        if (idx + 1 < len) setFocusedIndex(idx + 1);
        return;
      }
      if (e.key === "Escape") {
        setFocusedIndex(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile() {
    if (!proposedProfile || profileSaved) return;
    try {
      await createProfileMutation.mutateAsync({
        supplierId: proposedProfile.supplierId,
        profileName: `Auto-profile · ${new Date().toLocaleDateString()}`,
        detectionKeywords: proposedProfile.keywords,
        parserType: source === "vision" ? "hybrid" : source === "deterministic" ? "deterministic" : "ai_fallback",
        confidenceThreshold: Math.max(50, confidence - 10),
      });
      setProfileSaved(true);
      toast.success("Import profile saved. Future invoices from this supplier will use it.");
    } catch {
      toast.error("Could not save import profile.");
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        background: C.surface,
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "14px 20px",
          background: C.surfaceAlt,
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.ink,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Import review
        </span>
        <span
          style={{
            width: 1,
            height: 14,
            background: C.lineStrong,
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: C.muted,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <SourceIcon source={source} />
          {sourceLabel(source)}
        </span>
        <ConfidenceBadge pct={confidence} />
        {visionUsed && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 500,
              background: C.accentBg,
              color: C.accent,
              border: `1px solid ${C.accent}33`,
            }}
          >
            <Eye style={{ width: 10, height: 10 }} />
            Vision
          </span>
        )}
        {aiUsed && !visionUsed && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 500,
              background: C.surfaceAlt,
              color: C.muted,
              border: `1px solid ${C.line}`,
            }}
          >
            <Cpu style={{ width: 10, height: 10 }} />
            AI
          </span>
        )}
        {/* Spacer + keyboard shortcut toggle */}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          title="Keyboard shortcuts (?)"
          onClick={() => setShortcutsVisible(v => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 8px",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
            background: shortcutsVisible ? C.ink : "transparent",
            color: shortcutsVisible ? "#fff" : C.muted,
            border: `1px solid ${shortcutsVisible ? C.ink : C.line}`,
          }}
        >
          <Keyboard style={{ width: 11, height: 11 }} />
          ?
        </button>
      </div>

      {/* ── Keyboard shortcut strip ─────────────────────────────────────── */}
      {shortcutsVisible && (
        <div
          style={{
            padding: "10px 20px",
            background: "#18181b",
            borderBottom: `1px solid #3f3f46`,
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 20px",
            alignItems: "center",
          }}
        >
          {([
            ["J / K", "navigate rows"],
            ["1 2 3", "pick suggestion"],
            ["Enter", "accept top match"],
            ["I", "ignore row"],
            ["Esc", "clear focus"],
          ] as [string, string][]).map(([keys, desc]) => (
            <span key={keys} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 600, color: "#e4e4e7", background: "#27272a", border: "1px solid #3f3f46", borderBottomWidth: 2, borderRadius: 4, padding: "1px 6px" }}>
                {keys}
              </span>
              <span style={{ fontSize: 11, color: "#71717a" }}>{desc}</span>
            </span>
          ))}
          {focusedIndex !== null && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#52525b" }}>
              row {focusedIndex + 1} of {actionableUnresolved.length} focused
            </span>
          )}
        </div>
      )}

      {/* ── Summary stats row ───────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 0,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[
          {
            label: "Rows extracted",
            value: lineCount,
            color: lineCount > 0 ? C.good : C.error,
          },
          {
            label: "Matched products",
            value: matchedCount,
            color: matchedCount > 0 ? C.ink : C.muted,
          },
          {
            label: "Unresolved",
            value: blockingCount,
            color: blockingCount > 0 ? C.warn : C.good,
          },
          ...(totalComparison.extractedTotal
            ? [
                {
                  label: "PDF total",
                  value: `$${Number(totalComparison.extractedTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  color: C.ink,
                },
                {
                  label: "Computed total",
                  value: `$${Number(totalComparison.computedLineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  color: totalsOk ? C.good : totalsMismatch ? C.warn : C.ink,
                },
              ]
            : []),
          ...(hasFees
            ? [
                {
                  label: "Fees detected",
                  value: detectedFees.length,
                  color: C.warn,
                },
              ]
            : []),
          ...(priceDeviations.length > 0
            ? [
                {
                  label: "Price changes",
                  value: priceDeviations.length,
                  color: C.warn,
                },
              ]
            : []),
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "12px 16px",
              borderRight: `1px solid ${C.line}`,
            }}
          >
            <StatCell label={stat.label} value={stat.value} color={stat.color} />
          </div>
        ))}
      </div>

      {/* ── Reconcile widget (totals mismatch only) ───────────────────── */}
      {totalComparison.extractedTotal && totalsMismatch && (
        <ReconcileWidget
          pdfTotal={Number(totalComparison.extractedTotal)}
          lineTotal={Number(totalComparison.computedLineTotal)}
          chargesTotal={chargesTotal}
          detectedFeeCount={detectedFees.length}
        />
      )}

      {/* ── Confidence breakdown ───────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${C.line}` }}>
        <button
          type="button"
          onClick={() => setBreakdownExpanded(v => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: C.mutedSoft, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Confidence breakdown
          </span>
          {breakdownExpanded
            ? <ChevronUp style={{ width: 14, height: 14, color: C.mutedSoft }} />
            : <ChevronDown style={{ width: 14, height: 14, color: C.mutedSoft }} />}
        </button>
        {breakdownExpanded && (
          <div style={{ padding: "0 20px 14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 5, columnGap: 16 }}>
              {([
                ["Invoice number", confidenceBreakdown.invoiceNumberFound],
                ["Invoice date", confidenceBreakdown.invoiceDateFound],
                ["Supplier matched", confidenceBreakdown.supplierMatched],
                ["Lines extracted", confidenceBreakdown.linesExtracted],
                ["Totals match", confidenceBreakdown.totalsMatch],
              ] as [string, boolean | null][]).map(([label, val]) => (
                <>
                  <span style={{ fontSize: 12, color: C.ink2 }}>{label}</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: val === true ? C.good : val === false ? C.error : C.muted,
                  }}>
                    {val === true ? "✓" : val === false ? "✗" : "—"}
                  </span>
                </>
              ))}
              <span style={{ fontSize: 12, color: C.ink2 }}>Unmatched product ratio</span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: C.mono,
                color: confidenceBreakdown.unmatchedProductRatio === 0 ? C.good : C.warn,
              }}>
                {Math.round(confidenceBreakdown.unmatchedProductRatio * 100)}%
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: C.mutedSoft }}>
              Fallback path: <span style={{ fontWeight: 500, color: C.ink2 }}>{sourceLabel(source)}</span>
              {aiUsed && " · AI product matching applied"}
              {confidenceBreakdown.unmatchedProductRatio > 0 && " · some products unresolved"}
            </div>
            {(resolutionSummary.acceptedAiSuggestion > 0 ||
              resolutionSummary.manuallyMatched > 0 ||
              resolutionSummary.ignoredByUser > 0) && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: `1px solid ${C.line}`,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  rowGap: 5,
                  columnGap: 16,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: C.mutedSoft, letterSpacing: "0.04em", textTransform: "uppercase", gridColumn: "1 / -1", marginBottom: 2 }}>
                  Resolution summary
                </span>
                {resolutionSummary.acceptedAiSuggestion > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: C.ink2 }}>AI suggestions accepted</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.good }}>{resolutionSummary.acceptedAiSuggestion}</span>
                  </>
                )}
                {resolutionSummary.manuallyMatched > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: C.ink2 }}>Manually matched</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{resolutionSummary.manuallyMatched}</span>
                  </>
                )}
                {resolutionSummary.ignoredByUser > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: C.ink2 }}>Ignored (need attention)</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.warn }}>{resolutionSummary.ignoredByUser}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Inventory warnings ──────────────────────────────────────────── */}
      {inventoryWarnings.length > 0 && (
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <button
            type="button"
            onClick={() => setWarningsExpanded(v => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                fontWeight: 600,
                color: C.warn,
              }}
            >
              <AlertTriangle style={{ width: 13, height: 13 }} />
              {inventoryWarnings.length} warning{inventoryWarnings.length !== 1 ? "s" : ""}
            </span>
            {warningsExpanded ? (
              <ChevronUp style={{ width: 14, height: 14, color: C.mutedSoft }} />
            ) : (
              <ChevronDown style={{ width: 14, height: 14, color: C.mutedSoft }} />
            )}
          </button>

          {warningsExpanded && (
            <div style={{ padding: "0 20px 14px" }}>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {inventoryWarnings.map((w, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12,
                      color: C.ink2,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: C.warn, marginTop: 2, flexShrink: 0 }}>·</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Unresolved product review ───────────────────────────────────── */}
      {actionableUnresolved.length > 0 && (
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <button
            type="button"
            onClick={() => setUnresolvedExpanded(v => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                fontWeight: 600,
                color: blockingCount === 0 ? C.good : C.ink,
              }}
            >
              {blockingCount === 0
                ? <CheckCircle2 style={{ width: 13, height: 13, color: C.good }} />
                : <AlertTriangle style={{ width: 13, height: 13, color: C.warn }} />}
              {blockingCount === 0
                ? `All ${actionableUnresolved.length} product${actionableUnresolved.length !== 1 ? "s" : ""} handled`
                : `${blockingCount} product${blockingCount !== 1 ? "s" : ""} still need${blockingCount === 1 ? "s" : ""} review`}
            </span>
            {unresolvedExpanded ? (
              <ChevronUp style={{ width: 14, height: 14, color: C.mutedSoft }} />
            ) : (
              <ChevronDown style={{ width: 14, height: 14, color: C.mutedSoft }} />
            )}
          </button>

          {unresolvedExpanded && (
            <div style={{ padding: "0 20px 4px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "3fr 1fr",
                  gap: "4px 12px",
                  padding: "4px 0 8px",
                  borderBottom: `1px solid ${C.lineStrong}`,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.mutedSoft,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Vendor product name → suggested match
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.mutedSoft,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    textAlign: "right",
                  }}
                >
                  Actions
                </span>
              </div>
              {actionableUnresolved.map((line, i) => (
                <div
                  key={`${line.vendorProductName}-${i}`}
                  ref={el => { rowElRefs.current[i] = el; }}
                  style={focusedIndex === i ? {
                    marginLeft: -20,
                    marginRight: -20,
                    paddingLeft: 17,
                    paddingRight: 20,
                    borderLeft: `3px solid ${C.accent}`,
                    background: C.accentBg,
                  } : undefined}
                >
                  <UnresolvedRow
                    ref={el => { rowRefs.current[i] = el; }}
                    focused={focusedIndex === i}
                    line={line}
                    products={products}
                    supplierId={supplierId}
                    onResolved={(productId, how) => {
                      setResolvedCount(c => c + 1);
                      setResolutionSummary(s => ({
                        ...s,
                        acceptedAiSuggestion: s.acceptedAiSuggestion + (how === "accepted_ai" ? 1 : 0),
                        manuallyMatched: s.manuallyMatched + (how === "manual" ? 1 : 0),
                      }));
                      onVendorNameResolved(line.vendorProductName, productId);
                    }}
                    onIgnored={() =>
                      setResolutionSummary(s => ({ ...s, ignoredByUser: s.ignoredByUser + 1 }))
                    }
                    saveMutation={saveAliasMutation}
                    manualMutation={manualMutation}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Price change alerts ─────────────────────────────────────────── */}
      {priceDeviations.length > 0 && (
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <button
            type="button"
            onClick={() => setPriceChangesExpanded(v => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: C.warn }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              {priceDeviations.length} price change{priceDeviations.length !== 1 ? "s" : ""} vs last invoice
            </span>
            {priceChangesExpanded
              ? <ChevronUp style={{ width: 14, height: 14, color: C.mutedSoft }} />
              : <ChevronDown style={{ width: 14, height: 14, color: C.mutedSoft }} />}
          </button>
          {priceChangesExpanded && (
            <div style={{ padding: "0 20px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              {priceDeviations.map(d => {
                const up = d.deviationPct > 0;
                const pct = Math.abs(d.deviationPct).toFixed(1);
                const color = up ? C.error : C.good;
                const fmt = (v: number) =>
                  `$${v.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
                return (
                  <div
                    key={d.productId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "8px 10px",
                      borderRadius: 7,
                      background: up ? C.errorBg : C.goodBg,
                      border: `1px solid ${up ? C.errorBorder : C.goodBorder}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.productName}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        Last: {fmt(d.lastUnitPrice)} · {d.lastInvoiceDate}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontFamily: C.mono, color: C.ink2 }}>
                        {fmt(d.lastUnitPrice)} → {fmt(d.parsedUnitPrice)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: C.mono,
                          color,
                          background: color + "22",
                          border: `1px solid ${color}44`,
                          borderRadius: 99,
                          padding: "1px 7px",
                        }}
                      >
                        {up ? "+" : "−"}{pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Additional charges ──────────────────────────────────────────── */}
      {hasFees && (
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${C.line}`,
            background: C.warnBg,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.warn,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Additional charges (excluded from inventory)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {detectedFees.map((fee, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: C.ink2,
                }}
              >
                <span>{fee.description}</span>
                {fee.amount > 0 && (
                  <span
                    style={{
                      fontFamily: C.mono,
                      fontWeight: 600,
                      color: C.ink,
                    }}
                  >
                    ${fee.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Save import profile ─────────────────────────────────────────── */}
      {proposedProfile && !profileSaved && !profileDismissed && blockingCount === 0 && (
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${C.line}`,
            background: C.surfaceGood,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 3 }}>
                Save import profile for this supplier?
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                Future invoices will use this profile to skip AI parsing steps.
              </div>
              {proposedProfile.keywords.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: C.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Detection keywords:
                  </span>
                  {proposedProfile.keywords.map(kw => (
                    <span
                      key={kw}
                      style={{
                        fontSize: 11,
                        fontFamily: C.mono,
                        color: C.ink2,
                        background: C.surfaceAlt,
                        border: `1px solid ${C.line}`,
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setProfileDismissed(true)}
                style={smallGhostBtn}
              >
                No thanks
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={createProfileMutation.isPending || !supplierId}
                style={smallSecondaryBtn(createProfileMutation.isPending || !supplierId)}
              >
                {createProfileMutation.isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        </div>
      )}
      {proposedProfile && profileSaved && (
        <div
          style={{
            padding: "10px 20px",
            borderTop: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: C.good,
          }}
        >
          <CheckCircle2 style={{ width: 13, height: 13 }} />
          Import profile saved.
        </div>
      )}
    </div>
  );
}

// ── Button helpers ─────────────────────────────────────────────────────────

function smallPrimaryBtn(disabled: boolean): React.CSSProperties {
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
    background: C.ink,
    color: "#fff",
    border: "none",
    whiteSpace: "nowrap",
  };
}

function smallSecondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    background: C.surface,
    color: C.ink,
    border: `1px solid ${C.lineStrong}`,
    whiteSpace: "nowrap",
  };
}

const smallGhostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 400,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "transparent",
  color: C.muted,
  border: `1px solid ${C.line}`,
  whiteSpace: "nowrap",
};
