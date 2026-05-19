"use client";

import { AlertTriangle, ArrowRight, Check, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ConfidenceBar, StatusPill } from "./leaf";
import { fmtAmount } from "./mock-data";
import type { BatchFile } from "./types";

// Reproduced from
// modules/distribution/supplier-invoices/components/bulk-landing/file-row.tsx
// JSX + classes copied verbatim so the reel pixel-matches production.

const COLORS = {
  danger: "var(--color-danger-fg)",
  warn: "oklch(70% 0.16 70)",
  good: "var(--color-success-fg)",
  mutedSoft: "#9a9a93",
} as const;

export function FileRow({
  file,
  isFocused,
  onFocus,
  onOpen,
  onDismiss,
  reelTarget,
}: {
  file: BatchFile;
  isFocused: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onDismiss?: () => void;
  reelTarget?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-reel={reelTarget}
      onClick={onFocus}
      className={cn(
        "group grid cursor-pointer items-center gap-[18px] border-b border-border-default py-[18px] pl-[19px] pr-[22px] transition-colors hover:bg-divider/40",
        isFocused ? "bg-divider" : "bg-card",
      )}
      style={{
        gridTemplateColumns: "1fr 180px 180px 130px 130px",
        borderLeft: `3px solid ${isFocused ? "var(--color-forest-mid)" : "transparent"}`,
      }}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-subtle" strokeWidth={1.6} />
          <span className="truncate font-mono text-[13px] font-medium text-ink">
            {file.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pl-6 text-[12px] text-subtle">
          {file.supplier ? (
            <span>{file.supplier}</span>
          ) : (
            <span className="font-medium" style={{ color: COLORS.danger }}>
              Supplier missing
            </span>
          )}
          {file.invoiceNumber ? (
            <>
              <Dot />
              <span className="font-mono tabular-nums">#{file.invoiceNumber}</span>
            </>
          ) : null}
          <Dot />
          <span>
            {file.lineCount} {file.lineCount === 1 ? "line" : "lines"}
          </span>
          <Dot />
          <span className="font-mono tabular-nums">${fmtAmount(file.totalAmount)}</span>
        </div>
      </div>

      <div>
        <StatusPill status={file.status} />
      </div>

      <div>
        <div className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
          Parse confidence
        </div>
        <ConfidenceBar value={file.confidence} />
      </div>

      <div>
        {file.issues.length === 0 ? (
          <div
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: COLORS.good }}
          >
            <Check className="size-[14px]" strokeWidth={2.4} /> Clean
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
            {file.issues.slice(0, 2).map((iss, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-subtle"
              >
                <AlertTriangle
                  className="size-[14px] shrink-0"
                  strokeWidth={1.6}
                  style={{ color: iss.tone === "warn" ? COLORS.warn : COLORS.danger }}
                />
                <span>{iss.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={file.status === "reviewed" ? "outline" : "default"}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className={cn(
            "h-8 gap-1.5 text-[12px]",
            file.status !== "reviewed" &&
              "border-forest-mid bg-forest-mid text-card-warm hover:bg-forest",
          )}
        >
          {file.status === "reviewed" ? "Re-open" : "Review"}
          <ArrowRight className="size-3" strokeWidth={1.8} />
        </Button>
        {onDismiss ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label={`Dismiss ${file.name}`}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-subtle transition-opacity hover:bg-divider hover:text-ink",
              isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <X className="size-[14px]" strokeWidth={1.6} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden style={{ color: COLORS.mutedSoft }}>
      ·
    </span>
  );
}
