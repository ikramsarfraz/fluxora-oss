/**
 * Format a date string (yyyy-mm-dd or ISO) for display as mm/dd/yyyy.
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const s = String(dateStr).trim().slice(0, 10);
  if (s.length < 10) return dateStr;
  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateStr;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${mm}/${dd}/${y}`;
}
