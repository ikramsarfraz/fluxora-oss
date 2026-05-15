"use client";

import { AlertTriangle, ArrowRight, Check, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ConfidenceBar } from "./confidence-bar";
import { StatusPill } from "./status-pill";
import type { BatchFile } from "./types";

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLORS = {
  danger: "oklch(58% 0.18 25)",
  warn: "oklch(70% 0.16 70)",
  good: "oklch(58% 0.13 155)",
  mutedSoft: "#9a9a93",
} as const;

export function FileRow({
  file,
  isFocused,
  onFocus,
  onOpen,
}: {
  file: BatchFile;
  isFocused: boolean;
  onFocus: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus();
        }
      }}
      className={cn(
        "grid cursor-pointer items-center gap-[18px] border-b border-stone-line py-[18px] pl-[19px] pr-[22px] transition-colors hover:bg-stone-line2/40",
        isFocused ? "bg-stone-line2" : "bg-stone-surface",
      )}
      style={{
        gridTemplateColumns: "1fr 180px 180px 130px 130px",
        borderLeft: `3px solid ${isFocused ? "var(--stone-ink)" : "transparent"}`,
      }}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-stone-muted" strokeWidth={1.6} />
          <span className="truncate font-mono text-[13px] font-medium text-stone-ink">
            {file.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pl-6 text-[12px] text-stone-muted">
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
        <div className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
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
                className="inline-flex items-center gap-1.5 text-[11.5px] text-stone-muted"
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

      <div className="text-right">
        <Button
          type="button"
          size="sm"
          variant={file.status === "reviewed" ? "outline" : "default"}
          onClick={e => {
            e.stopPropagation();
            onOpen();
          }}
          className={cn(
            "h-8 gap-1.5 text-[12px]",
            file.status !== "reviewed" &&
              "border-stone-ink bg-stone-ink text-stone-surface hover:bg-stone-ink/90",
          )}
        >
          {file.status === "reviewed" ? "Re-open" : "Review"}
          <ArrowRight className="size-3" strokeWidth={1.8} />
        </Button>
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
