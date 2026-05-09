"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Eye, Cpu, FileText, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSaveConfirmedAiAlias,
  useRecordManualProductSelection,
  useCreateImportProfile,
} from "../hooks/use-supplier-invoices";
import type { PipelineResult, UnresolvedLine } from "../services/parsing-pipeline";
import type { ProductListItem } from "@/modules/distribution/products/services/products";

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

type Props = {
  pipelineResult: PipelineResult;
  products: ProductListItem[];
  supplierId: string | null;
  onVendorNameResolved: (vendorName: string, productId: string) => void;
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

function parseFeesFromWarnings(warnings: string[]): string[] {
  const feeWarnings: string[] = [];
  for (const w of warnings) {
    if (w.toLowerCase().includes("fee") || w.toLowerCase().includes("surcharge") || w.toLowerCase().includes("tax")) {
      feeWarnings.push(w);
    }
  }
  return feeWarnings;
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

function UnresolvedRow({
  line,
  lineIndex,
  products,
  supplierId,
  onResolved,
  saveMutation,
  manualMutation,
}: {
  line: UnresolvedLine;
  lineIndex: number;
  products: ProductListItem[];
  supplierId: string | null;
  onResolved: (productId: string) => void;
  saveMutation: ReturnType<typeof useSaveConfirmedAiAlias>;
  manualMutation: ReturnType<typeof useRecordManualProductSelection>;
}) {
  const [rowState, setRowState] = useState<RowState>("pending");
  const [chosenProductId, setChosenProductId] = useState<string>("");

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
      onResolved(line.suggestedProductId);
      toast.success(`Alias saved: "${line.vendorProductName}" → "${suggestedProduct?.name ?? line.suggestedProductId}"`);
    } catch {
      toast.error("Could not save alias.");
    }
  }

  async function handleChoose() {
    if (!chosenProductId || !supplierId) return;
    try {
      await manualMutation.mutateAsync({
        supplierId,
        vendorProductName: line.vendorProductName,
        internalProductId: chosenProductId,
      });
      setRowState("chosen");
      onResolved(chosenProductId);
      const prod = products.find(p => p.id === chosenProductId);
      toast.success(`Alias saved: "${line.vendorProductName}" → "${prod?.name ?? chosenProductId}"`);
    } catch {
      toast.error("Could not save alias.");
    }
  }

  const isBusy = saveMutation.isPending || manualMutation.isPending;

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
          {line.vendorProductName} · ignored
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
              onClick={() => setRowState("pending")}
              style={smallGhostBtn}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => setRowState("ignored")}
            disabled={isBusy}
            style={smallGhostBtn}
          >
            Ignore
          </button>
        </div>
      </div>

      {/* Choose different row */}
      {rowState === "choosing" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Select value={chosenProductId} onValueChange={setChosenProductId}>
              <SelectTrigger
                style={{
                  fontSize: 12,
                  height: 32,
                  border: `1px solid ${C.lineStrong}`,
                  borderRadius: 6,
                  background: C.surface,
                }}
              >
                <SelectValue placeholder="Select internal product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id} style={{ fontSize: 13 }}>
                    {p.name}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={handleChoose}
            disabled={!chosenProductId || isBusy}
            style={smallPrimaryBtn(!chosenProductId || isBusy)}
          >
            Save alias
          </button>
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
}: Props) {
  const [warningsExpanded, setWarningsExpanded] = useState(true);
  const [unresolvedExpanded, setUnresolvedExpanded] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);

  const saveAliasMutation = useSaveConfirmedAiAlias();
  const manualMutation = useRecordManualProductSelection();
  const createProfileMutation = useCreateImportProfile();

  const {
    prefillResult,
    confidence,
    source,
    visionUsed,
    unresolvedLines,
    detectedFees,
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

  const inventoryWarnings = warnings.filter(isInventoryWarning);

  const totalsMatch = totalComparison.matches;
  const totalsOk = totalsMatch === true;
  const totalsMismatch = totalsMatch === false;

  const hasFees = detectedFees.length > 0;

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
      </div>

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
            value: actionableUnresolved.length,
            color: actionableUnresolved.length > 0 ? C.warn : C.good,
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
                color: C.ink,
              }}
            >
              <AlertTriangle style={{ width: 13, height: 13, color: C.warn }} />
              {actionableUnresolved.length} product{actionableUnresolved.length !== 1 ? "s" : ""} need review
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
                <UnresolvedRow
                  key={`${line.vendorProductName}-${i}`}
                  line={line}
                  lineIndex={i}
                  products={products}
                  supplierId={supplierId}
                  onResolved={productId => onVendorNameResolved(line.vendorProductName, productId)}
                  saveMutation={saveAliasMutation}
                  manualMutation={manualMutation}
                />
              ))}
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
      {proposedProfile && !profileSaved && (
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
              Save import profile for this supplier?
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Future invoices will use this profile to skip AI parsing steps.
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={createProfileMutation.isPending || !supplierId}
            style={smallSecondaryBtn(createProfileMutation.isPending || !supplierId)}
          >
            {createProfileMutation.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      )}
      {proposedProfile && profileSaved && (
        <div
          style={{
            padding: "10px 20px",
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
