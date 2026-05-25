/**
 * Serialize a list of records to an RFC 4180-ish CSV string. Pairs
 * with {@link ../csv/parse:parseCsv} — `parseCsv(serializeCsv(rows))`
 * round-trips for any column values that don't contain U+0000.
 *
 * Cells get quoted only when they need to be (contain a comma, quote,
 * newline, or leading/trailing whitespace). Embedded quotes are
 * doubled. Headers are always emitted, even when `rows` is empty.
 *
 * Out of scope: streaming for very large datasets. Caller is responsible
 * for paginating if the export needs to fit in memory.
 */

const NEEDS_QUOTING = /[",\n\r]|^\s|\s$/;

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (!NEEDS_QUOTING.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function serializeCsv<T extends Record<string, unknown>>(
  headers: ReadonlyArray<{ key: keyof T & string; label: string }>,
  rows: ReadonlyArray<T>,
): string {
  const headerLine = headers.map(h => escapeCell(h.label)).join(",");
  const dataLines = rows.map(row =>
    headers.map(h => escapeCell(row[h.key])).join(","),
  );
  // Trailing newline — most tools handle it transparently and the parser
  // already skips blank trailing rows.
  return [headerLine, ...dataLines].join("\n") + "\n";
}
