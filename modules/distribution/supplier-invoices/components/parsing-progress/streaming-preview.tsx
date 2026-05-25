"use client";

import { Button } from "@/components/ui/button";

import { SkeletonField, StatusPill, StreamingLineItem } from "./primitives";
import type { PreviewHeader, StreamingLine } from "./types";

/**
 * Right card of the single-PDF parse screen: header strip with a Live/Done
 * pill, four header skeleton fields that fill in as the parse advances, the
 * streaming line list, and a footer with average-scan copy + a Cancel button.
 */
export function StreamingPreview({
  header,
  lines,
  lineCountLabel,
  averageParseLabel,
  isDone = false,
  onCancel,
}: {
  header: PreviewHeader;
  lines: StreamingLine[];
  lineCountLabel: string;
  averageParseLabel?: string;
  isDone?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-border-default bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-3.5">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">Streaming preview</div>
          <div className="mt-0.5 text-[11.5px] text-muted">
            Lines appear as they&apos;re extracted. You can start reviewing now.
          </div>
        </div>
        <StatusPill variant={isDone ? "done" : "live"} />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          <SkeletonField label="Supplier" value={header.supplier} />
          <SkeletonField label="Invoice #" value={header.invoiceNumber} mono />
          <SkeletonField label="Date" value={header.date} mono />
          <SkeletonField label="Total" value={header.total} mono />
        </div>

        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Line items
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted">
            {lineCountLabel}
          </div>
        </div>

        <div className="flex max-h-[340px] flex-col gap-[5px] overflow-y-auto pr-1">
          {lines.map((line, i) => (
            <StreamingLineItem
              key={line.id}
              id={line.id}
              raw={line.raw}
              total={line.total}
              state={line.state}
              delayIndex={i}
            />
          ))}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border-default bg-page px-5 py-3">
        <div className="text-[12px] text-muted">{averageParseLabel ?? ""}</div>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
