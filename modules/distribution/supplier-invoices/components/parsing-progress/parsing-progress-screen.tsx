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
  const isDone = job.overallProgress >= 100;

  return (
    <main className="-m-4 flex min-w-0 flex-1 flex-col bg-page">
      <header className="px-8 pb-[18px] pt-[24px]">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
          Step 1 of 2 · Scanning
        </div>
        <h1 className="mb-1.5 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
          Reading invoice
        </h1>
        <p className="max-w-[640px] text-[14px] text-subtle">
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
          isDone={isDone}
        />
        <StreamingPreview
          header={job.header}
          lines={job.lines}
          lineCountLabel={job.lineCountLabel}
          averageParseLabel={job.averageParseLabel}
          isDone={isDone}
          onCancel={onCancel}
        />
      </div>
    </main>
  );
}
