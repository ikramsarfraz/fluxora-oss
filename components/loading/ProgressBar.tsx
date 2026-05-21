"use client";

type ProgressColor = "blue" | "amber" | "green";

interface ProgressBarProps {
  value?: number; // 0-100; omit for indeterminate
  color?: ProgressColor;
  height?: number;
  className?: string;
  "aria-label"?: string;
}

const FILLS: Record<ProgressColor, string> = {
  blue: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
  amber:
    "linear-gradient(90deg, var(--color-warning-fg) 0%, color-mix(in oklch, var(--color-warning-fg) 55%, var(--color-warning-bg)) 100%)",
  green: "linear-gradient(90deg, #16a34a 0%, #4ade80 100%)",
};

export function ProgressBar({
  value,
  color = "blue",
  height = 6,
  className,
  "aria-label": ariaLabel = "Progress",
}: ProgressBarProps) {
  const indeterminate = value === undefined;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={className}
      style={{
        position: "relative",
        height,
        width: "100%",
        background: "var(--color-divider)",
        borderRadius: height / 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          background: FILLS[color],
          borderRadius: height / 2,
          ...(indeterminate
            ? {
                width: "30%",
                animation: "loading-progress-indeterminate 1.6s ease-in-out infinite",
              }
            : {
                width: `${Math.min(100, Math.max(0, value))}%`,
                transition: "width 0.3s ease",
              }),
        }}
      />
    </div>
  );
}
