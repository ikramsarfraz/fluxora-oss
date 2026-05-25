"use client";

// Design tokens from mockup: 0.8s spin, 3 sizes, 3 accent colors
const T = {
  blue: "var(--color-forest-mid)",
  amber: "var(--color-warning-fg)",
  green: "var(--color-success-fg)",
  white: "var(--color-card)",
  track: "var(--color-border-default)",
  trackOnDark: "rgba(255,255,255,0.3)",
} as const;

type SpinnerSize = "sm" | "default" | "lg";
type SpinnerColor = "blue" | "amber" | "green" | "white";

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  onDark?: boolean;
  className?: string;
}

const SIZES: Record<SpinnerSize, { w: number; h: number; bw: number }> = {
  sm: { w: 10, h: 10, bw: 1.5 },
  default: { w: 14, h: 14, bw: 2 },
  lg: { w: 22, h: 22, bw: 2.5 },
};

export function Spinner({
  size = "default",
  color = "blue",
  onDark = false,
  className,
}: SpinnerProps) {
  const { w, h, bw } = SIZES[size];
  const topColor = color === "white" ? T.white : T[color];
  const trackColor = onDark ? T.trackOnDark : T.track;

  return (
    <span
      className={`loading-spinner ${className ?? ""}`.trim()}
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: w,
        height: h,
        borderRadius: "50%",
        border: `${bw}px solid ${trackColor}`,
        borderTopColor: topColor,
        animation: "loading-spin 0.8s linear infinite",
      }}
    />
  );
}
