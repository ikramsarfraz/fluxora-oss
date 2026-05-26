/**
 * Format a date (yyyy-mm-dd / ISO string, or `Date`) for display as mm/dd/yyyy.
 */
export function formatDisplayDate(
  dateStr: string | Date | null | undefined
): string {
  if (dateStr == null || dateStr === "") return "—";
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return "—";
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, "0");
    const d = String(dateStr.getDate()).padStart(2, "0");
    return `${m}/${d}/${y}`;
  }
  const s = String(dateStr).trim().slice(0, 10);
  if (s.length < 10) return dateStr;
  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return dateStr;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${mm}/${dd}/${y}`;
}

/**
 * Format a timestamp (ISO string or `Date`) as a medium date + short time
 * using the user's locale (e.g. "May 22, 2026, 3:04 PM").
 */
export function formatDisplayDateTime(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Render a timestamp as a short relative phrase: "12 min ago", "yesterday",
 * "3 days ago", "last week", etc. Future timestamps render as "just now"
 * (we don't promise much past day-granularity).
 */
export function formatRelativeShort(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const deltaMs = now.getTime() - d.getTime();
  if (deltaMs < 60_000) return "just now";
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "last month" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "last year" : `${years} years ago`;
}
