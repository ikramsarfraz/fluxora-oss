/**
 * Period-over-period delta math for the dashboard cards.
 *
 * Given two counts (`current` and `prior`), returns the absolute
 * difference, a categorical direction, and an integer percentage
 * change rounded to the nearest whole number.
 *
 * Pct is intentionally `null` when `prior` is 0 — "+∞%" or "100% of
 * zero" both read wrong, so the consumer renders just the absolute
 * delta in that case.
 *
 * Pure function — no Date, no Intl, no side effects — so the tests
 * can lock the math down without faking time or locale.
 */

export type DeltaDirection = "up" | "down" | "flat";

export type DeltaResult = {
  /** `current - prior`. */
  diff: number;
  /** `up` when diff > 0, `down` when diff < 0, `flat` when diff === 0. */
  direction: DeltaDirection;
  /**
   * `Math.round((diff / prior) * 100)` when prior > 0. `null` when
   * prior is 0 (no defined percentage).
   */
  pct: number | null;
};

export function computeDelta(args: {
  current: number;
  prior: number;
}): DeltaResult {
  const diff = args.current - args.prior;
  const direction: DeltaDirection =
    diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const pct = args.prior > 0 ? Math.round((diff / args.prior) * 100) : null;
  return { diff, direction, pct };
}
