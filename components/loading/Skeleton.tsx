"use client";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = 12,
  borderRadius = 4,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`loading-shimmer ${className ?? ""}`.trim()}
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f4f4f5 0%, #fafafa 50%, #f4f4f5 100%)",
        backgroundSize: "200% 100%",
        animation: "loading-shimmer 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
