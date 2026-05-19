"use client";

import { Skeleton } from "./Skeleton";

interface ChartSkeletonProps {
  invoiceCount?: number;
  supplierCount?: number;
  etaSeconds?: number;
  barHeights?: number[]; // 0-100, defaults to 8 varied heights
}

const DEFAULT_HEIGHTS = [40, 60, 50, 75, 65, 85, 70, 90];

export function ChartSkeleton({
  invoiceCount,
  supplierCount,
  etaSeconds,
  barHeights = DEFAULT_HEIGHTS,
}: ChartSkeletonProps) {
  const label = [
    invoiceCount !== undefined && `Aggregating ${invoiceCount} invoice${invoiceCount !== 1 ? "s" : ""}`,
    supplierCount !== undefined && `from ${supplierCount} supplier${supplierCount !== 1 ? "s" : ""}`,
    "across 12 months…",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {/* Skeleton container */}
      <div
        style={{
          height: 180,
          background: "linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)",
          borderRadius: 8,
          padding: 14,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 4 stat boxes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} width="100%" height={18} borderRadius={5} />
          ))}
        </div>

        {/* 8 bar shapes */}
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            height: 100,
            bottom: 14,
            display: "flex",
            alignItems: "flex-end",
            gap: "6%",
          }}
        >
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="loading-pulse"
              style={{
                flex: 1,
                height: `${h}%`,
                background: "linear-gradient(180deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.03) 100%)",
                borderRadius: "3px 3px 0 0",
                animation: `loading-pulse 1.6s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Sweeping line */}
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            height: 2,
            top: "40%",
            background: "linear-gradient(90deg, transparent 0%, #2563eb 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "loading-shimmer 1.8s linear infinite",
            borderRadius: 2,
            opacity: 0.4,
          }}
        />
      </div>

      {/* Status line */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11.5,
          color: "var(--color-subtle)",
        }}
      >
        <span>{label || "Loading chart data…"}</span>
        {etaSeconds !== undefined && (
          <span
            style={{
              fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
              color: "var(--color-muted)",
            }}
          >
            ~{etaSeconds.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}
