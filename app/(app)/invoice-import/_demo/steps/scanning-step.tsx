"use client";

import { useEffect } from "react";
import { Check, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import { useDemo } from "../state";
import type { FileScanStage } from "../types";

const STAGES: FileScanStage[] = ["queued", "scanning", "extracting", "matching", "ready"];

const STAGE_LABEL: Record<FileScanStage, string> = {
  queued: "Queued",
  scanning: "Scanning pages",
  extracting: "Extracting line items",
  matching: "Matching products",
  ready: "Ready for review",
};

const STAGE_DURATION_MS: Record<FileScanStage, number> = {
  queued: 350,
  scanning: 900,
  extracting: 1400,
  matching: 1100,
  ready: 0,
};

export function ScanningStep() {
  const { state, dispatch } = useDemo();

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    state.files.forEach((file, fileIndex) => {
      if (file.stage === "ready") return;
      // Stagger files by 250ms each for parallel-but-not-locked-step feel
      const baseDelay = fileIndex * 250;
      let cumulative = baseDelay;
      let startStageIndex = STAGES.indexOf(file.stage);
      if (startStageIndex < 0) startStageIndex = 0;
      for (let i = startStageIndex; i < STAGES.length; i++) {
        const stage = STAGES[i];
        const duration = STAGE_DURATION_MS[stage];
        timeouts.push(
          setTimeout(() => {
            const progress = stage === "ready" ? 1 : (i + 1) / STAGES.length;
            dispatch({ type: "SET_FILE_STAGE", fileId: file.id, stage, progress });
          }, cumulative),
        );
        cumulative += duration;
      }
    });
    return () => timeouts.forEach(clearTimeout);
    // We only want to run this on mount per file set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allReady = state.files.every((f) => f.stage === "ready");

  useEffect(() => {
    if (!allReady) return;
    const t = setTimeout(() => {
      dispatch({ type: "INGEST_INVOICES" });
      dispatch({ type: "SET_STEP", step: "queue" });
    }, 700);
    return () => clearTimeout(t);
  }, [allReady, dispatch]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Importing invoices"
        description={
          allReady
            ? "All files ready. Moving to review queue…"
            : "Pages are scanned, line items extracted, and products matched in parallel."
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "upload" })}
        >
          Back
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-2.5">
        {state.files.map((f) => (
          <FileScanRow key={f.id} fileId={f.id} />
        ))}
      </div>
    </div>
  );
}

function FileScanRow({ fileId }: { fileId: string }) {
  const { state } = useDemo();
  const file = state.files.find((f) => f.id === fileId);
  if (!file) return null;
  const stageIndex = STAGES.indexOf(file.stage);
  const isReady = file.stage === "ready";

  return (
    <div className="rounded-md border border-border-default bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border-default bg-card-warm">
          <FileText className="size-3.5 text-forest-mid" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{file.filename}</div>
          <div className="text-xs text-subtle tabular-nums">
            {file.pages} page{file.pages === 1 ? "" : "s"} · {STAGE_LABEL[file.stage]}
          </div>
        </div>
        <div className="text-xs text-subtle tabular-nums">
          {Math.round(file.progress * 100)}%
        </div>
      </div>

      <div className="h-px w-full bg-border-soft" />

      <div className="flex items-center gap-1.5 px-4 py-3">
        {STAGES.map((s, i) => {
          const isPast = i < stageIndex;
          const isCurrent = i === stageIndex && !isReady;
          const isDone = isReady || isPast;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  isDone &&
                    "border-success-border bg-success-bg text-success-fg",
                  isCurrent && "border-forest-mid bg-card text-forest-mid",
                  !isDone && !isCurrent && "border-border-default bg-card text-muted",
                )}
              >
                {isDone ? (
                  <Check className="size-3" />
                ) : isCurrent ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span className="font-mono">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isDone && "text-success-fg",
                  isCurrent && "text-ink-warm",
                  !isDone && !isCurrent && "text-muted",
                )}
              >
                {STAGE_LABEL[s]}
              </span>
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "h-px w-6",
                    isDone ? "bg-success-border" : "bg-border-soft",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
