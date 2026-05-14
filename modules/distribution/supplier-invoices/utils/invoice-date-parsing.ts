// Pure date-string parsing for AI-extracted invoice dates. The OpenAI text and
// vision prompts ask for ISO YYYY-MM-DD, but the model frequently echoes the
// invoice's own format ("5/14/2026", "May 14, 2026", "5-14-26"). The form
// schema rejects anything but strict ISO, so the value must be normalized
// before it can prefill the form.
//
// Returns ISO YYYY-MM-DD on success, or null when the input is empty, missing,
// or doesn't look like a real date. No server-only imports — safe for tests.

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function toIso(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Use UTC to avoid Date constructor TZ surprises; this is a pure label
  // calendar date, not a moment in time.
  const ts = Date.UTC(year, month - 1, day);
  const reconstructed = new Date(ts);
  if (
    reconstructed.getUTCFullYear() !== year ||
    reconstructed.getUTCMonth() !== month - 1 ||
    reconstructed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandTwoDigitYear(value: number): number {
  // Common convention: 00–69 → 2000s, 70–99 → 1900s.
  // Invoices realistically only carry recent dates, so 2xxx is the right bias.
  if (value < 100) return value < 70 ? 2000 + value : 1900 + value;
  return value;
}

function parseSeparator(input: string): { y: number; m: number; d: number } | null {
  // ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  }

  // US MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY (also accepts single-digit month/day).
  // Two-digit year forms: MM/DD/YY → assume 2000–2069 / 1970–1999.
  const us = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (us) {
    return {
      m: Number(us[1]),
      d: Number(us[2]),
      y: expandTwoDigitYear(Number(us[3])),
    };
  }

  return null;
}

function parseWrittenMonth(input: string): { y: number; m: number; d: number } | null {
  // "April 20, 2026" or "Apr 20, 2026" or "April 20 2026"
  const monthFirst = input.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/);
  if (monthFirst) {
    const month = MONTH_NAMES[monthFirst[1].toLowerCase()];
    if (month != null) {
      return {
        m: month,
        d: Number(monthFirst[2]),
        y: expandTwoDigitYear(Number(monthFirst[3])),
      };
    }
  }

  // "20 April 2026" or "20 Apr 2026"
  const dayFirst = input.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{2}|\d{4})$/);
  if (dayFirst) {
    const month = MONTH_NAMES[dayFirst[2].toLowerCase()];
    if (month != null) {
      return {
        d: Number(dayFirst[1]),
        m: month,
        y: expandTwoDigitYear(Number(dayFirst[3])),
      };
    }
  }

  return null;
}

export function parseInvoiceDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already ISO? Validate it's a real calendar date.
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const numeric = parseSeparator(trimmed);
  if (numeric) return toIso(numeric.y, numeric.m, numeric.d);

  const written = parseWrittenMonth(trimmed);
  if (written) return toIso(written.y, written.m, written.d);

  return null;
}
