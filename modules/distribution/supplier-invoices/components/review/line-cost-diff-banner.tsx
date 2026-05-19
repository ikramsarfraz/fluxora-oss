"use client";

import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";

/**
 * Per-line cost-change callout. Mirrors the manual form's `CostDiffCallout`
 * but trimmed for the review queue's denser row layout — rendered as a
 * slim strip ABOVE the LineRow when the line's live cost-per-lb differs
 * from the recorded supplier cost (or no cost is recorded yet for this
 * supplier+product pair).
 *
 * The ack checkbox flips per-line acknowledgement state in the container;
 * unacknowledged "changed" / "new" entries block Complete & next so the
 * reviewer can't silently overwrite a recorded cost.
 */
export function LineCostDiffBanner({
  variant,
  recordedCostPerLb,
  liveCostPerLb,
  productName,
  dependentCustomerCount,
  acknowledged,
  onToggleAck,
}: {
  variant: "changed" | "new";
  recordedCostPerLb: string | null;
  liveCostPerLb: string;
  productName: string;
  dependentCustomerCount: number;
  acknowledged: boolean;
  onToggleAck: () => void;
}) {
  const recordedNum = recordedCostPerLb ? Number(recordedCostPerLb) : null;
  const liveNum = Number(liveCostPerLb);
  const deltaPct =
    recordedNum != null && recordedNum > 0
      ? ((liveNum - recordedNum) / recordedNum) * 100
      : null;
  const accent =
    variant === "new" ? "var(--color-success-fg)" : "oklch(60% 0.16 35)";
  const accentSoft =
    variant === "new"
      ? "color-mix(in oklch, var(--color-success-bg) 90%, transparent)"
      : "color-mix(in oklch, var(--color-warning-bg) 90%, transparent)";
  const accentBorder =
    variant === "new"
      ? "color-mix(in oklch, var(--color-success-fg) 30%, transparent)"
      : "color-mix(in oklch, var(--color-warning-fg) 30%, transparent)";

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-[12px]"
      style={{
        background: accentSoft,
        borderColor: accentBorder,
        color: "var(--color-forest-mid)",
      }}
    >
      <div className="inline-flex items-center gap-1.5 font-medium">
        {variant === "new" ? (
          <Sparkles
            className="size-[12px] shrink-0"
            strokeWidth={1.8}
            style={{ color: accent }}
          />
        ) : (
          <AlertTriangle
            className="size-[12px] shrink-0"
            strokeWidth={1.8}
            style={{ color: accent }}
          />
        )}
        <span>
          {variant === "new"
            ? "New cost for this supplier"
            : "Cost changed for this supplier"}
          {productName ? (
            <span className="text-subtle"> · {productName}</span>
          ) : null}
        </span>
      </div>

      <div className="inline-flex items-baseline gap-1.5 font-mono tabular-nums">
        {variant === "new" ? (
          <>
            <span className="text-subtle">—</span>
            <span className="text-subtle">→</span>
            <span className="font-semibold">${liveNum.toFixed(4)}</span>
          </>
        ) : (
          <>
            <span className="text-subtle">
              ${recordedNum != null ? recordedNum.toFixed(4) : "0.0000"}
            </span>
            <span className="text-subtle">→</span>
            <span className="font-semibold">${liveNum.toFixed(4)}</span>
            {deltaPct != null ? (
              <span
                className="font-medium"
                style={{
                  color: deltaPct >= 0 ? accent : "var(--color-success-fg)",
                }}
              >
                ({deltaPct >= 0 ? "+" : ""}
                {deltaPct.toFixed(1)}%)
              </span>
            ) : null}
          </>
        )}
      </div>

      {dependentCustomerCount > 0 ? (
        <div className="text-[11.5px] text-subtle">
          Affects{" "}
          <span className="font-semibold text-ink">
            {dependentCustomerCount} customer
            {dependentCustomerCount === 1 ? "" : "s"}
          </span>{" "}
          ·{" "}
          <Link
            href="/price-chart"
            target="_blank"
            rel="noreferrer"
            className="font-medium"
            style={{ color: accent }}
          >
            view in price chart
          </Link>
        </div>
      ) : (
        <div className="text-[11.5px] text-subtle">
          No customer prices pinned to this supplier yet.
        </div>
      )}

      <label
        className="ml-auto inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium"
        style={{
          color: acknowledged ? accent : "var(--color-forest-mid)",
          background: acknowledged ? "rgba(255,255,255,0.6)" : "transparent",
          border: `1px solid ${acknowledged ? accentBorder : "transparent"}`,
        }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={onToggleAck}
          className="size-[13px] cursor-pointer"
          style={{ accentColor: accent }}
        />
        {acknowledged ? "Acknowledged" : "Acknowledge"}
      </label>
    </div>
  );
}

/** Stable key per (product, supplier, new cost) triple — matches the
 *  manual form's `ackKey()` so an ack carries forward if the user
 *  switches between flows on the same data. */
export type LineCostAckKey = string;

export function ackKey(
  productId: string,
  supplierId: string,
  newCostPerLb: string,
): LineCostAckKey {
  return `${productId}::${supplierId}::${newCostPerLb}`;
}
