"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useReel } from "./reel-state";
import type { BatchFile, ReviewLine, ReviewLineMatchState } from "./types";

// Reproduced from production:
//   modules/distribution/supplier-invoices/components/review/queue-strip.tsx
//   modules/distribution/supplier-invoices/components/review/progress-indicator.tsx
//   modules/distribution/supplier-invoices/components/review/review-queue-header.tsx
//   modules/distribution/supplier-invoices/components/review/tokens.ts
// JSX, classes, and inline styles copied so the reel matches the real queue.

// ---------- Tokens ----------
const REVIEW_COLORS = {
  accent: "oklch(58% 0.13 242)",
  good: "oklch(58% 0.13 155)",
  warn: "oklch(70% 0.16 70)",
  danger: "oklch(58% 0.18 25)",
  mutedSoft: "#9a9a93",
} as const;

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function shortSupplier(name: string | null): string {
  if (!name) return "Supplier missing";
  return name.length > 22 ? `${name.slice(0, 22)}…` : name;
}

function shortInvoice(inv: string | null): string {
  if (!inv) return "no #";
  return `#${inv}`;
}

// ---------- Queue strip ----------
export function QueueStrip() {
  const { state } = useReel();
  const review = state.review;
  if (!review) return null;

  const queue = state.view.files;
  const currentKey = review.fileId;

  return (
    <div
      className="flex shrink-0 items-stretch border-b border-border-default"
      style={{ padding: "10px 14px", background: "#f3f1ea" }}
    >
      {/* Caption */}
      <div
        className="flex flex-col justify-center border-r border-border-default"
        style={{ paddingRight: 14, marginRight: 14, minWidth: 140 }}
      >
        <div
          className="font-semibold uppercase"
          style={{
            fontSize: 10,
            color: REVIEW_COLORS.mutedSoft,
            letterSpacing: "0.08em",
          }}
        >
          Review queue
        </div>
        <div className="mt-[3px] flex items-baseline gap-[6px]">
          <span className="font-mono text-[18px] font-bold tabular-nums text-ink">
            {queue.filter((f) => f.status !== "reviewed").length}
          </span>
          <span className="text-[12px] text-subtle">
            {queue.filter((f) => f.status !== "reviewed").length === 1
              ? "invoice left"
              : "invoices left"}
          </span>
        </div>
      </div>

      <ArrowButton disabled className="mr-[6px]" title="Previous (←)">
        <ChevronLeft className="size-[14px]" strokeWidth={1.6} />
      </ArrowButton>

      <div
        className="no-scrollbar flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto overflow-y-hidden"
        style={{ padding: 5, minHeight: 86 }}
      >
        {queue.map((entry, i) => (
          <QueueCard
            key={entry.id}
            entry={entry}
            position={i + 1}
            isCurrent={entry.id === currentKey}
          />
        ))}
      </div>

      <ArrowButton disabled className="ml-[6px]" title="Next (→)">
        <ChevronRight className="size-[14px]" strokeWidth={1.6} />
      </ArrowButton>
    </div>
  );
}

function QueueCard({
  entry,
  position,
  isCurrent,
}: {
  entry: BatchFile;
  position: number;
  isCurrent: boolean;
}) {
  const supplierWarn = !entry.supplier;
  const needsReview =
    entry.status === "needs-review"
      ? Math.max(1, entry.issues.length)
      : entry.status === "attention"
        ? entry.issues.length
        : 0;
  return (
    <button
      type="button"
      data-reel={`queue-card-${entry.id}`}
      className={cn(
        "relative flex shrink-0 flex-col gap-[5px] rounded-xl bg-card text-card-foreground text-left transition-[transform,box-shadow,opacity] duration-150",
        "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none",
        isCurrent
          ? "translate-y-[-2px] shadow-sm ring-2 ring-foreground/60"
          : "shadow-xs ring-1 ring-foreground/10 hover:translate-y-[-1px] hover:ring-foreground/30",
      )}
      style={{ minWidth: 230, maxWidth: 280, padding: "8px 10px" }}
    >
      {/* Row 1 */}
      <div className="flex items-center gap-[7px]">
        <span
          className="flex shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-bold tabular-nums"
          style={{
            width: 18,
            height: 18,
            background: isCurrent ? "var(--color-forest-mid)" : "var(--color-divider)",
            color: isCurrent ? "var(--color-card)" : "var(--color-subtle)",
          }}
        >
          {position}
        </span>
        <FileText
          className="size-[14px] shrink-0"
          strokeWidth={1.6}
          style={{
            color: isCurrent ? "var(--color-forest-mid)" : "var(--color-subtle)",
          }}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12px]",
            isCurrent ? "font-semibold text-ink" : "font-medium text-subtle",
          )}
        >
          {shortSupplier(entry.supplier)}
        </span>
      </div>

      {/* Row 2 */}
      <div
        className="flex items-center gap-[7px] text-[11px]"
        style={{ paddingLeft: 25 }}
      >
        <span className="font-mono" style={{ color: REVIEW_COLORS.mutedSoft }}>
          {shortInvoice(entry.invoiceNumber)}
        </span>
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>·</span>
        <span className="font-mono tabular-nums text-subtle">
          ${fmt(entry.totalAmount)}
        </span>
      </div>

      {/* Row 3: pills */}
      <div
        className="mt-px flex items-center gap-[6px]"
        style={{ paddingLeft: 25 }}
      >
        {supplierWarn ? (
          <span
            title="Supplier needs attention"
            className="block size-[6px] rounded-full"
            style={{ background: REVIEW_COLORS.warn }}
          />
        ) : null}
        {entry.status === "reviewed" ? (
          <span
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold"
            style={{ color: REVIEW_COLORS.good }}
          >
            <Check className="size-[10px]" strokeWidth={2.4} />
            Ready
          </span>
        ) : needsReview > 0 ? (
          <span
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold"
            style={{ color: REVIEW_COLORS.danger }}
          >
            <span
              className="block size-[5px] rounded-full"
              style={{ background: REVIEW_COLORS.danger }}
            />
            {needsReview} to fix
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold"
            style={{ color: REVIEW_COLORS.good }}
          >
            <Check className="size-[10px]" strokeWidth={2.4} />
            Ready
          </span>
        )}
        <span
          className="ml-auto font-mono text-[10px]"
          style={{ color: REVIEW_COLORS.mutedSoft }}
        >
          L{entry.lineCount}
        </span>
      </div>
    </button>
  );
}

function ArrowButton({
  disabled,
  title,
  className,
  children,
}: {
  disabled: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center self-center rounded-[8px] border border-border-default bg-card text-ink transition-colors",
        "enabled:hover:bg-[color:var(--color-divider)]",
        "disabled:cursor-not-allowed disabled:opacity-35",
        className,
      )}
      style={{ width: 34, height: 34 }}
    >
      {children}
    </button>
  );
}

// ---------- Progress indicator ----------
type ReviewCounts = { total: number; matched: number; needsReview: number; fees: number };

function computeCounts(lines: ReviewLine[]): ReviewCounts {
  let matched = 0;
  let needsReview = 0;
  let fees = 0;
  for (const l of lines) {
    const kind: ReviewLineMatchState["kind"] = l.match.kind;
    if (kind === "fee") fees++;
    else if (kind === "matched" && l.unitCost != null) matched++;
    else needsReview++;
  }
  return { total: lines.length, matched, needsReview, fees };
}

function ProgressIndicator({ counts }: { counts: ReviewCounts }) {
  const completed = counts.matched + counts.fees;
  const pct = counts.total === 0 ? 0 : (completed / counts.total) * 100;
  return (
    <div className="flex items-center gap-3" role="status">
      <Dot color={REVIEW_COLORS.good} label={`${counts.matched} matched`} />
      <Dot color={REVIEW_COLORS.danger} label={`${counts.needsReview} needs review`} />
      <Dot color={REVIEW_COLORS.mutedSoft} label={`${counts.fees} fee`} muted />
      <div className="ml-1.5 h-[5px] w-[120px] overflow-hidden rounded-[3px] bg-divider">
        <div
          className="h-full rounded-[3px] transition-[width] duration-300"
          style={{ width: `${pct}%`, background: REVIEW_COLORS.good }}
        />
      </div>
    </div>
  );
}

function Dot({
  color,
  label,
  muted,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-[7px] rounded-full" style={{ background: color }} />
      <span
        className={
          muted
            ? "text-[12.5px] font-medium text-subtle"
            : "text-[12.5px] font-medium text-ink"
        }
      >
        {label}
      </span>
    </div>
  );
}

// ---------- Review queue header (file chip + position + progress + actions) ----------
export function ReviewQueueHeader() {
  const { state, dispatch } = useReel();
  const review = state.review;
  if (!review) return null;

  const queue = state.view.files;
  const currentKey = review.fileId;
  const idx = queue.findIndex((f) => f.id === currentKey);
  const position = idx < 0 ? 1 : idx + 1;
  const total = queue.length;
  const hasNext = idx >= 0 && idx < total - 1;
  const isLastRemaining =
    queue.filter((f) => f.status !== "reviewed").length === 1;

  const counts = computeCounts(review.lines);
  const needsReviewBlock = counts.needsReview > 0;
  const blocked = needsReviewBlock;

  const completeLabel = needsReviewBlock
    ? `Resolve ${counts.needsReview} to continue`
    : hasNext
      ? "Complete & next"
      : isLastRemaining
        ? "Complete"
        : "Complete & finish";
  const showCompleteArrow = !blocked && hasNext;

  return (
    <div className="flex items-center justify-between gap-[18px] border-b border-border-default bg-page px-6 py-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {/* File chip */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-card py-[5px] pl-2 pr-2.5">
          <FileText
            className="size-4 shrink-0"
            strokeWidth={1.6}
            style={{ color: REVIEW_COLORS.danger }}
          />
          <span className="max-w-[300px] truncate font-mono text-[12px] font-medium text-ink">
            {review.fileName}
          </span>
        </div>

        {/* Position counter */}
        <span
          className="rounded font-mono text-[11px]"
          style={{
            color: REVIEW_COLORS.mutedSoft,
            background: "var(--color-divider)",
            padding: "4px 8px",
          }}
        >
          {position} of {total}
        </span>

        <ProgressIndicator counts={counts} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[12px]"
        >
          <ArrowLeft className="size-[12px]" strokeWidth={1.8} />
          Bulk list
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[12px]"
        >
          <RefreshCw className="size-[12px]" strokeWidth={1.6} />
          Re-scan
        </Button>

        {/* Segmented Skip / Complete & next */}
        <div className="flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            title="Skip without completing (→)"
            className="h-8 rounded-r-none border-r-0 text-[12px] disabled:opacity-50"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            size="sm"
            data-reel="submit-review"
            disabled={blocked}
            onClick={() => dispatch({ type: "SUBMIT_REVIEW" })}
            className={cn(
              "h-8 gap-1.5 rounded-l-none border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest",
              blocked && "cursor-not-allowed opacity-50",
            )}
          >
            {completeLabel}
            {showCompleteArrow ? (
              <ArrowRight
                className="size-[12px]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
