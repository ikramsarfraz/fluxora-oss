"use client";

export function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 70
      ? "oklch(58% 0.13 155)"
      : clamped >= 50
        ? "oklch(70% 0.16 70)"
        : "oklch(58% 0.18 25)";

  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] w-12 overflow-hidden rounded-[3px] bg-stone-line2">
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-stone-ink">
        {clamped}%
      </span>
    </div>
  );
}
