/**
 * Period-over-period helper for the platform-admin dashboard.
 *
 * Given a current window `{ since, until? }` and an optional reference
 * `now`, returns the prior window of equal length that ends strictly
 * before the current window starts.
 *
 * The result is exclusive on the boundary: `priorWindow.until` is the
 * millisecond immediately before `current.since` so a tenant created at
 * exactly `current.since` can't be counted in both periods.
 *
 * Examples
 * --------
 *   current.since = May 8, current.until = May 14  (7-day window)
 *   →  prior.until = May 8 minus 1 ms
 *      prior.since = May 1 minus 1 ms  (also 7 days back from prior.until)
 *
 *   current.since = May 1, current.until = null, now = May 28
 *   →  windowMs uses now() as the open-ended end → 27 days
 *      prior.until = May 1 minus 1 ms
 *      prior.since = (May 1 minus 1 ms) − 27 days
 *
 * The function is pure — no Date.now() unless the caller explicitly
 * omits both `current.until` and the `now` parameter — so it's safe to
 * unit-test by passing a fixed `now`.
 */

export type DashboardWindow = {
  since: Date;
  until?: Date | null;
};

export type DashboardPriorWindow = {
  since: Date;
  until: Date;
};

export function computePriorWindow(
  current: DashboardWindow,
  now: Date = new Date(),
): DashboardPriorWindow {
  // Open-ended windows treat "now" as their right edge so the period
  // length stays comparable across reloads of the same dashboard view.
  const windowEnd = current.until ?? now;
  const windowMs = windowEnd.getTime() - current.since.getTime();
  const priorEnd = new Date(current.since.getTime() - 1);
  const priorStart = new Date(current.since.getTime() - 1 - windowMs);
  return { since: priorStart, until: priorEnd };
}
