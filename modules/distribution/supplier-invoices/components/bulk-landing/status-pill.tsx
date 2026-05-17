"use client";

import type { BatchFileStatus } from "./types";

const TONES: Record<
  BatchFileStatus,
  { bg: string; fg: string; dot: string; label: string }
> = {
  reviewed:       { bg: "oklch(96% 0.03 155)", fg: "oklch(58% 0.13 155)", dot: "oklch(58% 0.13 155)", label: "Reviewed" },
  attention:      { bg: "oklch(96% 0.04 80)",  fg: "oklch(70% 0.16 70)",  dot: "oklch(70% 0.16 70)",  label: "Needs attention" },
  "needs-review": { bg: "oklch(96% 0.03 25)",  fg: "oklch(58% 0.18 25)",  dot: "oklch(58% 0.18 25)",  label: "Needs review" },
  "parse-error":  { bg: "oklch(94% 0.05 25)",  fg: "oklch(48% 0.18 25)",  dot: "oklch(48% 0.18 25)",  label: "Parse failed" },
};

export function StatusPill({ status }: { status: BatchFileStatus }) {
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
