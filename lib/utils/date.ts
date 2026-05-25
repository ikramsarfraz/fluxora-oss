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
