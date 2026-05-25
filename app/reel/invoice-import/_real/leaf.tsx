"use client";

// Leaf presentational components reproduced from
// modules/distribution/supplier-invoices/components/bulk-landing/ so the reel
// stays decoupled from the module's internal public surface (which doesn't
// export these — and shouldn't, since module boundaries forbid deep imports).
// JSX + classes copied verbatim from production so the reel pixel-matches.

import { cn } from "@/lib/utils";

import type { FileStatus } from "./types";

// ---------- ConfidenceBar ----------
export function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 70
      ? "var(--color-success-fg)"
      : clamped >= 50
        ? "oklch(70% 0.16 70)"
        : "var(--color-danger-fg)";

  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] w-12 overflow-hidden rounded-[3px] bg-divider">
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-ink">
        {clamped}%
      </span>
    </div>
  );
}

// ---------- StatusPill ----------
const TONES: Record<
  FileStatus,
  { bg: string; fg: string; dot: string; label: string }
> = {
  reviewed: {
    bg: "oklch(96% 0.03 155)",
    fg: "var(--color-success-fg)",
    dot: "var(--color-success-fg)",
    label: "Reviewed",
  },
  attention: {
    bg: "oklch(96% 0.04 80)",
    fg: "oklch(70% 0.16 70)",
    dot: "oklch(70% 0.16 70)",
    label: "Needs attention",
  },
  "needs-review": {
    bg: "oklch(96% 0.03 25)",
    fg: "var(--color-danger-fg)",
    dot: "var(--color-danger-fg)",
    label: "Needs review",
  },
  "parse-error": {
    bg: "oklch(94% 0.05 25)",
    fg: "oklch(48% 0.18 25)",
    dot: "oklch(48% 0.18 25)",
    label: "Couldn't read",
  },
};

export function StatusPill({ status }: { status: FileStatus }) {
  const tone = TONES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-[3px] pl-2 pr-2.5 text-[11px] font-semibold"
      style={{
        background: tone.bg,
        color: tone.fg,
        border: `1px solid color-mix(in oklch, ${tone.fg} 25%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  );
}

// ---------- MetricCard ----------
type Tone = "good" | "warn" | "neutral";

const TONE_COLOR: Record<Tone, string | undefined> = {
  good: "var(--color-success-fg)",
  warn: "oklch(70% 0.16 70)",
  neutral: undefined,
};

export function MetricCard({
  label,
  value,
  sub,
  mono,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div
          className={cn(
            "text-[22px] font-semibold leading-none tracking-[-0.01em]",
            mono && "font-mono tabular-nums",
          )}
          style={{ color: TONE_COLOR[tone] ?? "var(--color-forest-mid)" }}
        >
          {value}
        </div>
        {sub ? (
          <div className="text-[12px]" style={{ color: "#9a9a93" }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}
