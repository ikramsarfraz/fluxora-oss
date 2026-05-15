"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Filter, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FileRow } from "./file-row";
import { MetricCard } from "./metric-card";
import type { BatchFile, BatchFilter, BatchView } from "./types";

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTER_OPTIONS: { value: BatchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs", label: "Needs review" },
  { value: "reviewed", label: "Reviewed" },
];

function matchFilter(file: BatchFile, filter: BatchFilter): boolean {
  if (filter === "all") return true;
  if (filter === "reviewed") return file.status === "reviewed";
  return file.status !== "reviewed";
}

function startWithLabel(name: string): string {
  // Take the first underscore-separated chunk and cap it so the button stays compact.
  const head = name.split("_")[0] ?? name;
  return head.length > 12 ? `${head.slice(0, 12)}…` : head;
}

export function BulkLandingScreen({
  view,
  openFileHref,
  openInNewTab = false,
  onImportMore,
}: {
  view: BatchView;
  /**
   * URL builder for the per-row Review action. When omitted (demo mode), the
   * file id is treated as a supplier-invoice id and routed to the detail page;
   * the real bulk-landing supplies a path that includes the localStorage key.
   */
  openFileHref?: (file: BatchFile) => string;
  /** When true, the Review action opens in a new tab — required by the handoff. */
  openInNewTab?: boolean;
  /** Click handler for "Import more"; falls back to a no-op in demo mode. */
  onImportMore?: () => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<BatchFilter>("all");
  const [focusedId, setFocusedId] = useState<string | null>(view.files[1]?.id ?? null);

  const visibleFiles = useMemo(
    () => view.files.filter(f => matchFilter(f, filter)),
    [view.files, filter],
  );

  const nextFile = view.files.find(f => f.status !== "reviewed") ?? null;

  const openFile = (file: BatchFile) => {
    const href = openFileHref ? openFileHref(file) : `/supplier-invoices/${file.id}`;
    if (openInNewTab && typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  return (
    <main className="-m-4 flex min-w-0 flex-1 flex-col bg-stone-bg">
      <header className="flex items-end justify-between gap-6 px-8 pb-[22px] pt-[28px]">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
            Bulk import · {view.summary.filesProcessed}{" "}
            {view.summary.filesProcessed === 1 ? "file" : "files"}
          </div>
          <h1 className="mb-2 text-[26px] font-semibold leading-tight tracking-[-0.015em] text-stone-ink">
            Review parsed invoices
          </h1>
          <p className="max-w-[640px] text-[14px] text-stone-muted">
            Files were parsed and fields suggested by AI. Confirm each one before they post to inventory.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportMore}
            disabled={!onImportMore}
            className="h-9 gap-1.5 text-[13px]"
          >
            <Upload className="size-[14px]" strokeWidth={1.6} />
            Import more
          </Button>
          {nextFile ? (
            <Button
              type="button"
              size="sm"
              onClick={() => openFile(nextFile)}
              className="h-9 gap-1.5 border-stone-ink bg-stone-ink text-[13px] text-stone-surface hover:bg-stone-ink/90"
            >
              Start with {startWithLabel(nextFile.name)}
              <ArrowRight className="size-3" strokeWidth={1.8} />
            </Button>
          ) : null}
        </div>
      </header>

      <SummaryStrip view={view} />

      <div className="mx-8 mb-7 overflow-hidden rounded-[12px] border border-stone-line bg-stone-surface">
        <FilesCardHeader filter={filter} onFilterChange={setFilter} />
        <ColumnHeader />
        {visibleFiles.length === 0 ? (
          <div className="px-[22px] py-12 text-center text-[13px] text-stone-muted">
            No files match this filter.
          </div>
        ) : (
          visibleFiles.map(file => (
            <FileRow
              key={file.id}
              file={file}
              isFocused={focusedId === file.id}
              onFocus={() => setFocusedId(file.id)}
              onOpen={() => openFile(file)}
            />
          ))
        )}
        <CardFooter readyToPost={view.summary.readyToPost} />
      </div>
    </main>
  );
}

function SummaryStrip({ view }: { view: BatchView }) {
  const { summary } = view;
  const ratio =
    summary.filesProcessed === 0 ? 0 : summary.readyToPost / summary.filesProcessed;
  return (
    <div
      className="mx-8 mb-[18px] grid items-center gap-6 rounded-[12px] border border-stone-line bg-stone-surface px-6 py-[18px]"
      style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}
    >
      <MetricCard label="Files processed" value={summary.filesProcessed} />
      <MetricCard
        label="Ready to post"
        value={summary.readyToPost}
        sub={`of ${summary.filesProcessed}`}
        tone={summary.readyToPost === summary.filesProcessed ? "good" : "neutral"}
      />
      <MetricCard
        label="Needs your review"
        value={summary.needsReview}
        tone={summary.needsReview > 0 ? "warn" : "good"}
      />
      <MetricCard label="Combined value" value={`$${fmtAmount(summary.combinedValue)}`} mono />
      <div className="flex flex-col items-end gap-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
          Batch progress
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-md bg-stone-line2">
          <div
            className="h-full rounded-md"
            style={{ width: `${ratio * 100}%`, background: "oklch(58% 0.13 155)" }}
          />
        </div>
      </div>
    </div>
  );
}

function FilesCardHeader({
  filter,
  onFilterChange,
}: {
  filter: BatchFilter;
  onFilterChange: (filter: BatchFilter) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-line bg-stone-line2 px-[22px] py-3">
      <div className="flex items-center gap-3.5">
        <div className="text-[13px] font-semibold text-stone-ink">Files in this batch</div>
        <div className="flex gap-1 rounded-[7px] border border-stone-line bg-stone-surface p-[3px]">
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFilterChange(opt.value)}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  active
                    ? "bg-stone-ink text-stone-surface"
                    : "text-stone-muted hover:text-stone-ink",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-stone-muted">
        <span>
          Sorted by: <span className="font-medium text-stone-ink">Lowest confidence first</span>
        </span>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md border border-stone-line bg-stone-surface text-stone-muted hover:text-stone-ink"
          aria-label="Sort options"
        >
          <Filter className="size-[14px]" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function ColumnHeader() {
  return (
    <div
      className="grid gap-[18px] border-b border-stone-line bg-stone-bg px-[22px] py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted"
      style={{ gridTemplateColumns: "1fr 180px 180px 130px 130px" }}
    >
      <div className="pl-[3px]">File · supplier · invoice</div>
      <div>Status</div>
      <div>Confidence</div>
      <div>Issues</div>
      <div className="text-right">Action</div>
    </div>
  );
}

function CardFooter({ readyToPost }: { readyToPost: number }) {
  return (
    <div className="flex items-center justify-between bg-stone-bg px-[22px] py-3.5">
      <div className="text-[12px] text-stone-muted">
        Each file opens in a new tab so you don&apos;t lose this list.
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] text-stone-muted">Bulk:</span>
        <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]">
          Re-parse all
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={readyToPost === 0}
          className="h-8 border-stone-ink bg-stone-ink text-[12px] text-stone-surface hover:bg-stone-ink/90"
        >
          Post {readyToPost} reviewed
        </Button>
      </div>
    </div>
  );
}
