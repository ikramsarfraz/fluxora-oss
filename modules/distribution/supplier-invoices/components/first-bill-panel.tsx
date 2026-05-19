"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import type { PipelineResult, FirstBillLine } from "../services/parsing-pipeline";
import { saveFirstBillAction } from "../actions";
import { captureClientEvent } from "@/lib/posthog-client";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  surface: "var(--color-card)",
  surfaceAlt: "var(--color-divider)",
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  mutedSoft: "var(--color-muted)",
  line: "var(--color-border-default)",
  lineStrong: "var(--color-border-default)",
  good: "var(--color-success-fg)",
  goodBg: "oklch(95% 0.04 155)",
  goodBorder: "oklch(85% 0.07 155)",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  mono: "var(--font-mono)",
} as const;

// ── PDF pane ───────────────────────────────────────────────────────────────

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

// ── Row state ──────────────────────────────────────────────────────────────

type RowEntry = {
  rawVendorText: string;
  userProductName: string;
  reviewed: boolean;
  quantityCases: string;
  weightLbs: string;
  unitPrice: string;
  unitType: "catch_weight" | "fixed_case";
};

function buildInitialRows(firstBillLines: FirstBillLine[]): RowEntry[] {
  return firstBillLines.map(l => ({
    rawVendorText: l.rawVendorText,
    userProductName: l.suggestedName,
    reviewed: false,
    quantityCases: l.quantityCases,
    weightLbs: l.weightLbs,
    unitPrice: l.unitPrice,
    unitType: l.unitType,
  }));
}

// ── ProductRow ─────────────────────────────────────────────────────────────

function ProductRow({
  row,
  onNameChange,
  onReviewed,
  onDelete,
  disabled,
}: {
  row: RowEntry;
  onNameChange: (v: string) => void;
  onReviewed: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFocus() {
    if (!row.reviewed) onReviewed();
  }

  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${C.line}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Supplier text + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `1.5px solid ${row.reviewed ? C.good : C.lineStrong}`,
            background: row.reviewed ? C.goodBg : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: row.reviewed ? C.good : C.mutedSoft,
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {row.reviewed ? "✓" : "+"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.mutedSoft,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Supplier:{" "}
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontFamily: C.mono,
              color: C.muted,
            }}
          >
            {row.rawVendorText}
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: C.mutedSoft,
              fontStyle: "italic",
              marginLeft: 8,
            }}
          >
            → will become alias
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          style={{
            fontSize: 11,
            color: C.mutedSoft,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            padding: "2px 7px",
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          Remove
        </button>
      </div>

      {/* Product name input */}
      <input
        ref={inputRef}
        type="text"
        value={row.userProductName}
        onFocus={handleFocus}
        onChange={e => {
          if (!row.reviewed) onReviewed();
          onNameChange(e.target.value);
        }}
        disabled={disabled}
        placeholder="Your product name…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          border: `1.5px solid ${row.reviewed ? C.good : C.lineStrong}`,
          borderRadius: 8,
          outline: "none",
          background: C.surface,
          color: C.ink,
          transition: "border-color 0.15s",
        }}
      />

      {/* Hint */}
      <div style={{ fontSize: 10.5, color: C.mutedSoft }}>
        {row.reviewed
          ? "Accepted — edit to match how you list it on your price sheet"
          : "Suggestion · auto-cleaned from supplier text"}
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  pipelineResult: PipelineResult;
  pendingPdfFile?: File | null;
};

// ── Main component ─────────────────────────────────────────────────────────

export function FirstBillPanel({ pipelineResult, pendingPdfFile }: Props) {
  const router = useRouter();

  const prefill = pipelineResult.prefillResult.values;
  const firstBillLines = pipelineResult.firstBillLines ?? [];

  const [supplierName, setSupplierName] = useState(
    pipelineResult.prefillResult.unmatchedSupplierCandidates[0] ?? "",
  );
  const [invoiceNumber, setInvoiceNumber] = useState(prefill.supplierInvoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    prefill.invoiceDate || new Date().toISOString().slice(0, 10),
  );
  const [rows, setRows] = useState<RowEntry[]>(() => buildInitialRows(firstBillLines));
  const [isSaving, setIsSaving] = useState(false);
  const [namesEdited, setNamesEdited] = useState(false);

  useEffect(() => {
    captureClientEvent("first_bill.viewed", { line_count: firstBillLines.length });
  }, [firstBillLines.length]);

  const productCount = rows.length;
  const aliasCount = rows.length;

  function handleNameChange(i: number, v: string) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, userProductName: v } : r)));
    if (!namesEdited) {
      setNamesEdited(true);
      captureClientEvent("first_bill.names_edited", { line_count: rows.length });
    }
  }

  function handleReviewed(i: number) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, reviewed: true } : r)));
  }

  function handleDelete(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(asDraft: boolean) {
    const emptyNames = rows.filter(r => !r.userProductName.trim());
    if (emptyNames.length > 0) {
      toast.error("Give every product a name before saving.");
      return;
    }
    if (!supplierName.trim()) {
      toast.error("Enter a supplier name before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveFirstBillAction({
        supplierName: supplierName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        receiveDate: invoiceDate,
        asDraft,
        lines: rows.map(r => ({
          rawVendorText: r.rawVendorText,
          userProductName: r.userProductName.trim(),
          quantityCases: Number(r.quantityCases) || 1,
          weightLbs: r.weightLbs,
          unitPrice: r.unitPrice,
          unitType: r.unitType,
        })),
      });
      toast.success(
        asDraft
          ? "Draft saved — review quantities, weights, and pricing before completing."
          : "Catalog seeded — review quantities, weights, and pricing before completing.",
      );
      // Land on the edit form so the user can verify and adjust qty / weight /
      // unit price for each line. The first-bill panel only exposes vendor →
      // product-name mapping; the saved draft still needs a full review pass.
      router.push(`/supplier-invoices/${result.invoiceId}/edit`);
    } catch (err) {
      toast.error((err as Error).message ?? "Could not save.");
      setIsSaving(false);
    }
  }

  const inputCls: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    border: `1px solid ${C.lineStrong}`,
    borderRadius: 7,
    outline: "none",
    background: C.surface,
    color: C.ink,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        overflow: "hidden",
        background: C.surface,
      }}
    >
      {/* ── PDF pane ───────────────────────────────────────────────────── */}
      {pendingPdfFile && (
        <div
          style={{
            width: 380,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 72,
            height: "calc(100vh - 110px)",
            alignSelf: "flex-start",
            borderRight: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              padding: "9px 12px",
              background: C.surfaceAlt,
              borderBottom: `1px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileText style={{ width: 11, height: 11, color: C.mutedSoft }} />
            <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pipelineResult.prefillResult.sourceFilename}
            </span>
          </div>
          <div style={{ flex: 1, background: "#e5e5e5", overflow: "hidden" }}>
            <PdfPane file={pendingPdfFile} />
          </div>
        </div>
      )}

      {/* ── Review pane ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Banner */}
        <div
          style={{
            padding: "16px 20px",
            background: C.purpleBg,
            borderBottom: `1px solid #ddd6fe`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 5 }}>
            First bill — name your products
          </div>
          <div style={{ fontSize: 12.5, color: "#5b21b6", lineHeight: 1.6, maxWidth: 540 }}>
            Each line below is a product you&apos;re buying.{" "}
            <em>Tell us what you call it in your business</em> — that name becomes your canonical
            product, and the supplier&apos;s wording is remembered as an alias for next time.{" "}
            <strong>You can edit later, but it&apos;s easier to get it right now.</strong>
          </div>
        </div>

        {/* Bill metadata */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.line}`,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Supplier name *</label>
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="e.g. Carnivore Meats Inc."
              disabled={isSaving}
              style={inputCls}
            />
          </div>
          <div>
            <label style={labelStyle}>Invoice #</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="Optional"
              disabled={isSaving}
              style={inputCls}
            />
          </div>
          <div>
            <label style={labelStyle}>Invoice date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              disabled={isSaving}
              style={inputCls}
            />
          </div>
        </div>

        {/* Framing strip */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: `1px solid ${C.line}`,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
            background: C.surfaceAlt,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: C.purpleBg,
                border: "1px solid #ddd6fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              📄
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mutedSoft, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Supplier calls it
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>raw vendor text</div>
            </div>
          </div>
          <div style={{ fontSize: 16, color: C.lineStrong }}>→</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: C.greenBg,
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mutedSoft, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                You call it
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>your canonical product name</div>
            </div>
          </div>
        </div>

        {/* Product rows */}
        {rows.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              fontSize: 13,
              color: C.mutedSoft,
            }}
          >
            No line items extracted from this PDF. Enter them manually below.
          </div>
        ) : (
          rows.map((row, i) => (
            <ProductRow
              key={i}
              row={row}
              onNameChange={v => handleNameChange(i, v)}
              onReviewed={() => handleReviewed(i)}
              onDelete={() => handleDelete(i)}
              disabled={isSaving}
            />
          ))
        )}

        {/* Footer card */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: `1px solid ${C.line}`,
            background: C.surfaceAlt,
            position: "sticky",
            bottom: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>⭐</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                  Saving creates{" "}
                  <strong>{productCount}</strong>{" "}
                  {productCount === 1 ? "product" : "products"} + 1 supplier + {" "}
                  <strong>{aliasCount}</strong>{" "}
                  {aliasCount === 1 ? "alias" : "aliases"}.
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
                Each supplier name above will be remembered, so the next bill from this supplier
                auto-matches without you touching it.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving}
                style={{
                  padding: "8px 14px",
                  border: `1px solid ${C.lineStrong}`,
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  background: C.surface,
                  color: C.ink,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                Save as draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                style={{
                  padding: "8px 18px",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  background: C.ink,
                  color: "var(--color-card)",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {isSaving ? "Saving…" : `Save & review →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
