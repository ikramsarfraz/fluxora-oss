"use client";

import { StageTimeline } from "./stage-timeline";
import { StreamingPreview } from "./streaming-preview";
import type { ParseJobView } from "./types";

export function ParsingProgressScreen({
  job,
  onCancel,
}: {
  job: ParseJobView;
  onCancel?: () => void;
}) {
  return (
    <main className="-m-4 flex min-w-0 flex-1 flex-col bg-stone-bg">
      <header className="px-8 pb-[22px] pt-[28px]">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
          Step 1 of 2 · Parsing
        </div>
        <h1 className="mb-1.5 text-[26px] font-semibold leading-tight tracking-[-0.015em] text-stone-ink">
          Reading invoice
        </h1>
        <p className="max-w-[640px] text-[14px] text-stone-muted">
          We extract supplier, line items, weights and prices using OCR + AI matching against your
          catalog. You&apos;ll get to review every field before posting.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-[18px] px-8 pb-7 lg:grid-cols-2">
        <StageTimeline
          fileName={job.fileName}
          fileSizeLabel={job.fileSizeLabel}
          uploadedLabel={job.uploadedLabel}
          elapsedSeconds={job.elapsedSeconds}
          overallProgress={job.overallProgress}
          stages={job.stages}
        />
        <StreamingPreview
          header={job.header}
          lines={job.lines}
          lineCountLabel={job.lineCountLabel}
          averageParseLabel={job.averageParseLabel}
          onCancel={onCancel}
        />
      </div>
    </main>
  );
}
