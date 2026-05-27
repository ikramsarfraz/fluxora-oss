/**
 * Pure helpers for product price-intelligence classification. No DB access,
 * no server-only imports — safe to reach from React Server Components, the
 * service, and unit tests.
 *
 * Thresholds are intentionally constants (not tenant settings) for v1 — the
 * issue's #1 open question said start hardcoded and revisit when we have
 * real signal from production tenants. The constants are exported so the
 * UI can show the same number the service is gating on.
 */

/** Below this absolute delta, treat the movement as noise — surface in
 *  muted typography, no banner. */
export const PRICE_DRIFT_NOISE_PCT = 5;
/** Above this absolute delta, escalate to a banner-level alert at the top
 *  of the price-intelligence section. Between the two values is a soft
 *  "drift" band — colored text but no banner. */
export const PRICE_DRIFT_ALERT_PCT = 15;
/** A single purchase further than this fraction from the median is treated
 *  as a likely data-entry error (decimal in wrong place, wrong unit, etc.)
 *  and excluded from the running-average baseline. 0.5 = ±50% from median. */
export const PRICE_OUTLIER_FACTOR = 0.5;
/** Cap on how many recent purchases the sparkline series carries. Keeps
 *  the section light + the chart legible. */
export const PRICE_INTELLIGENCE_SERIES_LIMIT = 20;

export type DriftBand = "flat" | "drift" | "alert";

/**
 * Classify a delta-from-baseline fraction into one of three bands. Used by
 * the detail page to pick between muted / colored / banner-level treatment
 * AND by the service when deciding whether to surface a supplier in the
 * banner's per-supplier rollup.
 */
export function classifyDriftBand(
  deltaFraction: number | null | undefined,
): DriftBand {
  if (deltaFraction == null || !Number.isFinite(deltaFraction)) return "flat";
  const pct = Math.abs(deltaFraction) * 100;
  if (pct >= PRICE_DRIFT_ALERT_PCT) return "alert";
  if (pct >= PRICE_DRIFT_NOISE_PCT) return "drift";
  return "flat";
}

/**
 * Returns the median of a numeric series. Empty array returns null —
 * callers should treat that as "no baseline yet". Tolerates non-finite
 * numbers by filtering them out first.
 */
export function medianOf(values: readonly number[]): number | null {
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export type OutlierTaggedPurchase<T> = T & { isOutlier: boolean };

/**
 * Tag each purchase as `isOutlier: true` when its unit price is further
 * than `PRICE_OUTLIER_FACTOR` from the median. Caller decides whether to
 * filter them or just render them with a warning chip. The median is
 * always computed across the FULL set (including suspects) so a sample
 * of two with one obvious bad row still classifies cleanly: median is
 * resistant to a single outlier in a way that mean is not.
 */
export function flagOutlierPurchases<T extends { unitPrice: number }>(
  purchases: readonly T[],
): Array<OutlierTaggedPurchase<T>> {
  const med = medianOf(purchases.map(p => p.unitPrice));
  if (med == null || med <= 0) {
    // No median to anchor against — flag nothing rather than tagging
    // everything (which would be wrong, not protective).
    return purchases.map(p => ({ ...p, isOutlier: false }));
  }
  const lo = med * (1 - PRICE_OUTLIER_FACTOR);
  const hi = med * (1 + PRICE_OUTLIER_FACTOR);
  return purchases.map(p => ({
    ...p,
    isOutlier: p.unitPrice < lo || p.unitPrice > hi,
  }));
}
