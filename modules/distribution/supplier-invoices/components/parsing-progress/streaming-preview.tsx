"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PreviewHeader, StreamingLine } from "./types";

const COLORS = {
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.03 155)",
  accent: "oklch(58% 0.13 242)",
  mutedSoft: "#9a9a93",
} as const;

export function StreamingPreview({
  header,
  lines,
  lineCountLabel,
  averageParseLabel,
  onCancel,
}: {
  header: PreviewHeader;
  lines: StreamingLine[];
  lineCountLabel: string;
  averageParseLabel?: string;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-stone-line bg-stone-surface">
      <PreviewHeaderStrip />

      <div className="flex-1 px-[22px] py-[14px]">
        <div className="mb-[18px] grid grid-cols-2 gap-[14px]">
          <PreviewChip label="Supplier" value={header.supplier} />
          <PreviewChip label="Invoice #" value={header.invoiceNumber} mono />
          <PreviewChip label="Date" value={header.date} mono />
          <PreviewChip label="Total" value={header.total} mono highlight />
        </div>

        <div
          className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: COLORS.mutedSoft }}
        >
          Line items · {lineCountLabel}
        </div>

        <div className="flex flex-col gap-[5px]">
          {lines.map(line => (
            <LineRow key={line.id} line={line} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-line bg-stone-bg px-[22px] py-[14px]">
        <div className="text-[12px] text-stone-muted">
          {averageParseLabel ?? ""}
        </div>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={onCancel}
          >
            Cancel parse
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PreviewHeaderStrip() {
  return (
    <div className="flex items-center justify-between border-b border-stone-line px-[22px] py-[16px]">
      <div>
        <div className="text-[14px] font-semibold text-stone-ink">Streaming preview</div>
        <div className="mt-0.5 text-[11px]" style={{ color: COLORS.mutedSoft }}>
          Lines appear as they&apos;re extracted. You can start reviewing now.
        </div>
      </div>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{
          background: COLORS.goodSoft,
          color: COLORS.good,
          border: `1px solid color-mix(in oklch, ${COLORS.good} 25%, transparent)`,
        }}
      >
        <span
          className="size-1.5 animate-pulse rounded-full"
          style={{ background: COLORS.good }}
        />
        Live
      </span>
    </div>
  );
}

function PreviewChip({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-line bg-stone-line2 px-3 py-2.5">
      <div
        className="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: COLORS.mutedSoft }}
      >
        {label}
      </div>
      <div
        className={cn(
          "truncate text-stone-ink",
          mono && "font-mono tabular-nums",
          highlight ? "text-[16px] font-semibold" : "text-[13px] font-medium",
        )}
      >
        {value ?? <span style={{ color: COLORS.mutedSoft }}>—</span>}
      </div>
    </div>
  );
}

function LineRow({ line }: { line: StreamingLine }) {
  const pending = line.state === "pending";
  const parsing = line.state === "parsing";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[7px] px-2.5 py-2",
        pending ? "bg-stone-line2 opacity-40" : "bg-stone-surface",
      )}
      style={{
        border: `1px solid ${parsing ? COLORS.accent : "var(--stone-line)"}`,
      }}
    >
      <span
        className="w-[22px] font-mono text-[10.5px] font-semibold"
        style={{ color: COLORS.mutedSoft }}
      >
        L{line.id}
      </span>

      {pending ? (
        <div
          className="h-[14px] flex-1 rounded-[3px]"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent 0 6px, oklch(94% 0.01 95) 6px 7px)",
          }}
        />
      ) : (
        <span className="flex-1 truncate font-mono text-[11.5px] text-stone-ink">
          {line.raw}
        </span>
      )}

      {line.state === "parsed" && line.total ? (
        <span className="font-mono text-[12px] font-semibold tabular-nums text-stone-ink">
          {line.total}
        </span>
      ) : null}

      {parsing ? (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: COLORS.accent }}
        >
          <span
            className="size-1.5 animate-pulse rounded-full"
            style={{ background: COLORS.accent }}
          />
          parsing…
        </span>
      ) : null}
    </div>
  );
}
