"use client";

import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "neutral";

const TONE_COLOR: Record<Tone, string | undefined> = {
  good: "oklch(58% 0.13 155)",
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
  /** Small grey text shown to the right of the value, e.g. "of 4". */
  sub?: string;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div
          className={cn(
            "text-[22px] font-semibold leading-none tracking-[-0.01em]",
            mono && "font-mono tabular-nums",
          )}
          style={{ color: TONE_COLOR[tone] ?? "var(--stone-ink)" }}
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
