/**
 * Format a number or string as USD with exactly 2 decimal places: $0.00
 */
export function formatMoney(value: string | number | null | undefined): string {
  const n = value == null || value === "" ? NaN : typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
