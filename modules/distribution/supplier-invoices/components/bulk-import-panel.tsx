"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { useBulkImportSupplierInvoices } from "../hooks/use-supplier-invoices";
import type {
  BulkImportItemResult,
  BulkImportResult,
} from "../services/bulk-import";
import {
  BULK_IMPORT_LS_PREFIX,
  clearPendingBulkImport,
  storePendingBulkImport,
} from "../utils/bulk-import-storage";

// Mirrors the server-side cap; surfaced here so the UI can guide rather than
// just reject. Keep in sync with BULK_IMPORT_MAX_FILES.
const MAX_FILES_CLIENT_HINT = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// ── Design tokens — match the rest of the supplier-invoices module ────────
const C = {
  text: "#18181b",
  text2: "#52525b",
  text3: "#a1a1aa",
  border: "#e7e7ea",
  borderStrong: "#d4d4d8",
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  surfaceMuted: "#f4f4f5",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  mono: "var(--font-geist-mono, 'JetBrains Mono', ui-monospace, monospace)",
} as const;

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PendingFile = {
  file: File;
  reason?: string;
};

// Track which result rows have been "reviewed" (opened) so the user can see
// at a glance which items they still need to handle. Persists only for the
// life of the panel — closing the tab is treated as starting over.
type ResultRowState = {
  storageKey: string | null;
  reviewed: boolean;
};

export function BulkImportPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [rowState, setRowState] = useState<ResultRowState[]>([]);

  const mutation = useBulkImportSupplierInvoices();
  const isImporting = mutation.isPending;

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setResult(null);
    setRowState([]);
    const next: PendingFile[] = [];
    const existingNames = new Set(pending.map(p => p.file.name));
    for (const f of Array.from(incoming)) {
      // Defensive client-side filtering. The server re-validates.
      let reason: string | undefined;
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
        reason = "Not a PDF";
      } else if (f.size === 0) {
        reason = "Empty file";
      } else if (f.size > MAX_FILE_BYTES) {
        reason = `Exceeds ${fmtBytes(MAX_FILE_BYTES)}`;
      } else if (existingNames.has(f.name)) {
        reason = "Already added";
      }
      next.push({ file: f, reason });
      existingNames.add(f.name);
    }
    setPending(prev => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_FILES_CLIENT_HINT) {
        toast.error(
          `Up to ${MAX_FILES_CLIENT_HINT} PDFs per batch — extras will be ignored.`,
        );
      }
      return merged.slice(0, MAX_FILES_CLIENT_HINT);
    });
  }, [pending]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset the input so the same file can be re-selected after removal.
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function removeAt(index: number) {
    setPending(prev => prev.filter((_, i) => i !== index));
  }

  async function startImport() {
    const usable = pending.filter(p => !p.reason);
    if (usable.length === 0) {
      toast.error("Nothing to import — every file has an issue.");
      return;
    }
    const formData = new FormData();
    for (const p of usable) {
      formData.append("file", p.file);
    }
    try {
      const r = await mutation.mutateAsync(formData);

      // Persist each parsed pipeline result to localStorage so the
      // single-import flow in a new tab can seed from it without re-parsing.
      const rowStates: ResultRowState[] = r.items.map(item => {
        if (item.status === "parsed") {
          const key = storePendingBulkImport(item);
          return { storageKey: key, reviewed: false };
        }
        return { storageKey: null, reviewed: false };
      });
      setRowState(rowStates);
      setResult(r);
      setPending([]);
      const { parsed, errored } = r.summary;
      const parts: string[] = [];
      if (parsed > 0) parts.push(`${parsed} ready to review`);
      if (errored > 0) parts.push(`${errored} failed`);
      toast.success(parts.join(" · ") || "Import finished.");
    } catch (err) {
      toast.error((err as Error).message ?? "Import failed.");
    }
  }

  // Refresh "reviewed" indicators when the user returns to this tab — the
  // review tab clears its localStorage entry on save, so an empty key means
  // the item has been handled.
  useEffect(() => {
    if (!result) return;
    const refresh = () => {
      setRowState(prev =>
        prev.map(state => {
          if (!state.storageKey) return state;
          const stillPending =
            typeof window !== "undefined" &&
            window.localStorage.getItem(state.storageKey) !== null;
          return stillPending ? state : { ...state, reviewed: true };
        }),
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(BULK_IMPORT_LS_PREFIX)) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [result]);

  // ── Results screen ─────────────────────────────────────────────────────
  if (result) {
    return (
      <BulkImportResults
        result={result}
        rowState={rowState}
        onStartOver={() => {
          // Best-effort cleanup of unconsumed localStorage entries so we
          // don't leak parse data across sessions.
          for (const state of rowState) {
            if (state.storageKey) clearPendingBulkImport(state.storageKey);
          }
          setResult(null);
          setRowState([]);
        }}
      />
    );
  }

  // ── Picker screen ──────────────────────────────────────────────────────
  const usableCount = pending.filter(p => !p.reason).length;

  return (
    <div
      style={{
        borderRadius: 14,
        background: C.surface,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Bulk import supplier bills
        </h3>
        <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
          Drop or pick up to {MAX_FILES_CLIENT_HINT} PDFs. Each one is parsed and
          handed to single-import for your review — every file becomes a separate
          &quot;needs review&quot; entry. No drafts are written until you confirm them
          one at a time.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          margin: 20,
          padding: "36px 20px",
          border: `2px dashed ${isDraggingOver ? C.blue : C.borderStrong}`,
          borderRadius: 12,
          background: isDraggingOver ? C.blueBg : C.surfaceAlt,
          cursor: isImporting ? "not-allowed" : "pointer",
          textAlign: "center",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
          {isDraggingOver
            ? "Drop PDFs to add them"
            : "Drag PDFs here, or click to pick"}
        </div>
        <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>
          Up to {MAX_FILES_CLIENT_HINT} files · {fmtBytes(MAX_FILE_BYTES)} each max
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileInput}
          disabled={isImporting}
          style={{ display: "none" }}
        />
      </div>

      {/* Pending list */}
      {pending.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div
            style={{
              padding: "12px 20px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: C.text3,
              borderBottom: `1px solid ${C.border}`,
              background: C.surfaceMuted,
            }}
          >
            Selected — {usableCount} of {pending.length} ready
          </div>
          {pending.map((p, i) => (
            <div
              key={`${p.file.name}-${i}`}
              style={{
                padding: "10px 20px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                borderBottom: i < pending.length - 1 ? `1px solid ${C.border}` : undefined,
                background: p.reason ? C.redBg : C.surface,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: C.mono,
                    color: C.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.file.name}
                </div>
                <div style={{ fontSize: 11, color: p.reason ? C.red : C.text3, marginTop: 2 }}>
                  {p.reason ?? fmtBytes(p.file.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={isImporting}
                style={{
                  fontSize: 11,
                  color: C.text2,
                  background: "none",
                  border: `1px solid ${C.borderStrong}`,
                  borderRadius: 5,
                  padding: "3px 9px",
                  cursor: isImporting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer / actions */}
      <div
        style={{
          padding: "14px 20px",
          background: C.surfaceAlt,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, color: C.text2 }}>
          {usableCount === 0
            ? "Pick at least one PDF to start."
            : `Ready to parse ${usableCount} file${usableCount === 1 ? "" : "s"}.`}
        </div>
        <button
          type="button"
          onClick={startImport}
          disabled={isImporting || usableCount === 0}
          style={{
            padding: "8px 16px",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            background: usableCount === 0 || isImporting ? C.text3 : C.text,
            color: "#fff",
            cursor: usableCount === 0 || isImporting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: isImporting ? 0.6 : 1,
          }}
        >
          {isImporting
            ? `Parsing ${usableCount} file${usableCount === 1 ? "" : "s"}…`
            : `Parse ${usableCount > 0 ? usableCount : ""} ${usableCount === 1 ? "PDF" : "PDFs"} →`}
        </button>
      </div>

      {isImporting && (
        <div
          style={{
            padding: "10px 20px",
            background: C.blueBg,
            color: C.blue,
            fontSize: 12,
            borderTop: `1px solid ${C.blueBorder}`,
          }}
        >
          Parsing each PDF in order — this takes ~5–15 seconds per file.
        </div>
      )}
    </div>
  );
}

// ── Results screen ────────────────────────────────────────────────────────

function BulkImportResults({
  result,
  rowState,
  onStartOver,
}: {
  result: BulkImportResult;
  rowState: ResultRowState[];
  onStartOver: () => void;
}) {
  const { items, summary } = result;
  const allErrored = summary.errored === summary.total;
  const allReviewed =
    summary.parsed > 0 &&
    rowState.every((state, i) =>
      items[i].status === "error" ? true : state.reviewed,
    );

  return (
    <div
      style={{
        borderRadius: 14,
        background: C.surface,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header / summary */}
      <div
        style={{
          padding: "16px 20px",
          background: allReviewed
            ? `linear-gradient(135deg, ${C.greenBg} 0%, #ecfdf5 100%)`
            : allErrored
              ? `linear-gradient(135deg, ${C.redBg} 0%, #fff1f2 100%)`
              : `linear-gradient(135deg, ${C.amberBg} 0%, #fff7ed 100%)`,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {allReviewed
            ? "All files reviewed"
            : allErrored
              ? "Import finished — no files parsed"
              : "Parsed — every file needs review"}
        </h3>
        <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
          {summary.total} file{summary.total === 1 ? "" : "s"} processed ·{" "}
          <strong style={{ color: C.amber }}>
            {summary.parsed} need{summary.parsed === 1 ? "s" : ""} review
          </strong>
          {summary.errored > 0 && (
            <>
              {" "}·{" "}
              <strong style={{ color: C.red }}>{summary.errored} failed</strong>
            </>
          )}
          <div style={{ marginTop: 6, color: C.text3, fontSize: 11.5 }}>
            Each &quot;Review&quot; link opens in a new tab so you don&apos;t lose this list
            while you confirm the others.
          </div>
        </div>
      </div>

      {/* Per-file results */}
      <div>
        {items.map((item, i) => (
          <div
            key={`${item.filename}-${i}`}
            style={{
              padding: "12px 20px",
              borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : undefined,
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 12,
              alignItems: "start",
              opacity: rowState[i]?.reviewed ? 0.55 : 1,
            }}
          >
            <StatusBadge
              status={item.status}
              reviewed={rowState[i]?.reviewed ?? false}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: C.mono,
                  color: C.text,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.filename}
              </div>
              <ResultDetail item={item} />
            </div>
            <ResultAction
              item={item}
              storageKey={rowState[i]?.storageKey ?? null}
              reviewed={rowState[i]?.reviewed ?? false}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          background: C.surfaceAlt,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/supplier-invoices"
          style={{
            fontSize: 13,
            color: C.text,
            textDecoration: "underline",
          }}
        >
          ← Back to bills
        </Link>
        <button
          type="button"
          onClick={onStartOver}
          style={{
            padding: "8px 14px",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            border: `1px solid ${C.borderStrong}`,
            background: C.surface,
            color: C.text,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Import more
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  reviewed,
}: {
  status: "parsed" | "error";
  reviewed: boolean;
}) {
  if (status === "error") {
    return <Pill bg={C.redBg} color={C.red} border={C.redBorder} label="Error" />;
  }
  if (reviewed) {
    return (
      <Pill bg={C.greenBg} color={C.green} border={C.greenBorder} label="Reviewed" />
    );
  }
  return (
    <Pill bg={C.amberBg} color={C.amber} border={C.amberBorder} label="Needs review" />
  );
}

function Pill({
  label,
  bg,
  color,
  border,
}: {
  label: string;
  bg: string;
  color: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${border}`,
        minWidth: 86,
        justifyContent: "center",
      }}
    >
      {label}
    </span>
  );
}

function ResultDetail({ item }: { item: BulkImportItemResult }) {
  if (item.status === "parsed") {
    const issues: string[] = [];
    if (!item.supplierMatched) issues.push("supplier not matched");
    if (item.unmatchedLineCount > 0) {
      issues.push(
        `${item.unmatchedLineCount} of ${item.lineCount} line${
          item.lineCount === 1 ? "" : "s"
        } unmatched`,
      );
    }
    return (
      <div style={{ fontSize: 11.5, color: C.text2, marginTop: 3 }}>
        {item.supplierName ? `${item.supplierName} · ` : ""}
        {item.lineCount} line{item.lineCount === 1 ? "" : "s"} · $
        {item.computedLineTotal}
        {issues.length > 0 && (
          <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>
            ⚠ {issues.join(" · ")}
          </div>
        )}
        {item.warnings.length > 0 && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
            {item.warnings.length} parsing warning
            {item.warnings.length === 1 ? "" : "s"} — visible on the review form
          </div>
        )}
      </div>
    );
  }
  return <div style={{ fontSize: 11.5, color: C.red, marginTop: 3 }}>{item.error}</div>;
}

function ResultAction({
  item,
  storageKey,
  reviewed,
}: {
  item: BulkImportItemResult;
  storageKey: string | null;
  reviewed: boolean;
}) {
  if (item.status === "error") return null;
  if (!storageKey) return null;

  // Open in a NEW TAB so the user can review each file without losing the
  // bulk-import results page (and the other in-flight items on it).
  const href = `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(storageKey)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: 500,
        border: `1px solid ${C.borderStrong}`,
        color: C.text,
        textDecoration: "none",
        background: C.surface,
      }}
    >
      {reviewed ? "Open again ↗" : "Review →"}
    </a>
  );
}
