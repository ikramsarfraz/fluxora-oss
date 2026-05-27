/**
 * Threshold-based classification of a line's live cost-per-lb vs the recorded
 * cost for the same (product, supplier) pair. Pure helper — same shape on
 * client and server — so the review screen, the manual bill form, and any
 * future server-side validation all reach the same verdict.
 *
 * Inputs are decimal strings (as stored in `product_supplier_costs.costPerLb`
 * and computed by `supplierInvoiceLineCostPerLb`), parsed leniently — non-
 * numeric or non-positive recorded costs collapse to `"new"` so we don't
 * silently anchor an anomaly check against a zero/garbage baseline.
 */

/** Anomaly fires when |delta| exceeds this fraction of the recorded cost. */
export const COST_ANOMALY_THRESHOLD = 0.15;

export type CostDeltaClassification =
  /** No recorded cost yet — first invoice for this (product, supplier). */
  | { kind: "new" }
  /** Recorded cost equals live cost — nothing to flag. */
  | { kind: "unchanged" }
  /** Within ±15% of recorded — surface as a light "changed" note. */
  | { kind: "changed"; deltaFraction: number }
  /** Movement exceeded the anomaly threshold — needs a verified ack. */
  | { kind: "anomaly"; deltaFraction: number };

export function classifyCostDelta(
  recordedCostPerLb: string | null | undefined,
  liveCostPerLb: string | null | undefined,
): CostDeltaClassification | null {
  if (liveCostPerLb == null) return null;
  const live = Number(liveCostPerLb);
  if (!Number.isFinite(live) || live < 0) return null;

  if (recordedCostPerLb == null) return { kind: "new" };
  const recorded = Number(recordedCostPerLb);
  if (!Number.isFinite(recorded) || recorded <= 0) return { kind: "new" };

  if (recordedCostPerLb === liveCostPerLb) return { kind: "unchanged" };

  const deltaFraction = (live - recorded) / recorded;
  if (Math.abs(deltaFraction) > COST_ANOMALY_THRESHOLD) {
    return { kind: "anomaly", deltaFraction };
  }
  return { kind: "changed", deltaFraction };
}
