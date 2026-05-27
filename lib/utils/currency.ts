/**
 * Format a weight value to 2 decimal places: "12.50"
 */
export function formatWeightLbs(value: string | number | null | undefined): string {
  return (Number(value) || 0).toFixed(2);
}

/**
 * Closed set of currencies a tenant can opt into (#232 phase 1). Mirrors
 * the `tenant_base_currency` Postgres enum — extending one without the
 * other will trip the schema check at runtime, so update both in lockstep.
 *
 * The locale is the BCP-47 tag we pass to `Intl.NumberFormat` so the
 * symbol position, thousands separator, and decimal separator follow
 * the convention a native speaker expects. We deliberately don't read
 * the browser's locale — a US-based tenant invoicing in EUR should still
 * see "€" in front of the amount because that's how the currency mark
 * is written; mixing the user's locale with the tenant's currency
 * produces oddities like "1,234.56 €" that look broken.
 */
export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD";

export const SUPPORTED_CURRENCIES: ReadonlyArray<{
  code: CurrencyCode;
  /** Symbol the formatter will render; surfaced in the settings dropdown. */
  symbol: string;
  /** Human label for the settings dropdown. */
  label: string;
  /** BCP-47 locale used by `Intl.NumberFormat` for this currency. */
  locale: string;
}> = [
  { code: "USD", symbol: "$", label: "US Dollar (USD)", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro (EUR)", locale: "en-IE" },
  { code: "GBP", symbol: "£", label: "British Pound (GBP)", locale: "en-GB" },
  { code: "CAD", symbol: "$", label: "Canadian Dollar (CAD)", locale: "en-CA" },
];

const CURRENCY_BY_CODE: Record<CurrencyCode, (typeof SUPPORTED_CURRENCIES)[number]> =
  Object.fromEntries(SUPPORTED_CURRENCIES.map(c => [c.code, c])) as Record<
    CurrencyCode,
    (typeof SUPPORTED_CURRENCIES)[number]
  >;

const FALLBACK_CURRENCY: CurrencyCode = "USD";

/**
 * Normalize the optional second arg. Unknown codes fall back to USD so a
 * stale client cache or a future enum value never crashes the formatter
 * at render time — the worst case is the user sees "$" instead of the
 * right symbol until the page reloads.
 */
function resolveCurrency(code: CurrencyCode | string | undefined) {
  if (!code) return CURRENCY_BY_CODE[FALLBACK_CURRENCY];
  const upper = code.toUpperCase();
  if (upper in CURRENCY_BY_CODE) {
    return CURRENCY_BY_CODE[upper as CurrencyCode];
  }
  return CURRENCY_BY_CODE[FALLBACK_CURRENCY];
}

/**
 * Format a number or string as a currency-marked amount with exactly 2
 * decimal places. The optional second arg lets the caller pass the
 * tenant's `baseCurrency` so the symbol and locale follow the tenant
 * setting; omitting it preserves the original USD-only behavior so the
 * 226 existing call sites keep working until they're plumbed (#232
 * phase 2 sweep). The NaN / null guard intentionally renders the
 * fallback in the chosen currency — "—" or "0.00" reads wrong if the
 * surrounding column header says "EUR".
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency?: CurrencyCode | string,
): string {
  const meta = resolveCurrency(currency);
  const n =
    value == null || value === ""
      ? NaN
      : typeof value === "string"
        ? parseFloat(value)
        : value;
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Display-only conversion for the workspace-settings card. The DB stores
 * the rate as a fraction (0.0825 = 8.25%); the UI shows the percent
 * form. Keep both shapes round-trippable via {@link parseTaxRatePercent}.
 */
export function formatTaxRatePercent(
  fraction: string | number | null | undefined,
): string {
  if (fraction == null || fraction === "") return "";
  const n = typeof fraction === "string" ? parseFloat(fraction) : fraction;
  if (!Number.isFinite(n)) return "";
  // Trim trailing zeros so "8.25" doesn't become "8.2500" in the input,
  // but keep enough precision for unusual rates like 9.625%.
  return (n * 100).toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Inverse of {@link formatTaxRatePercent}. Returns `null` for empty
 * strings ("no default tax") and throws for non-numeric input — the
 * settings form filters those out before this is called, but the throw
 * keeps callers honest.
 */
export function parseTaxRatePercent(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new Error("Tax rate must be a number.");
  }
  if (n < 0 || n > 99.99) {
    throw new Error("Tax rate must be between 0 and 99.99 percent.");
  }
  // Persist as the fraction (0.0825 for 8.25%) with 4 decimal places to
  // match the numeric(5,4) column.
  return (n / 100).toFixed(4);
}
