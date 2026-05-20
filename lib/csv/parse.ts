/**
 * RFC 4180-ish CSV parser.
 *
 * Handles the cases the previous .split(",") parser silently corrupted:
 *   - Fields wrapped in double quotes containing commas:   "Acme, Inc",x,y
 *   - Escaped quotes inside quoted fields:                 "He said ""hi"""
 *   - Quoted fields spanning multiple lines:               "line 1\nline 2"
 *   - Mixed line endings (CRLF and LF).
 *   - A UTF-8 BOM at the start of the file.
 *   - Trailing blank lines (skipped).
 *
 * Returns headers + row records, where each row is keyed by the *raw*
 * header (no normalization — the caller handles that, since the import
 * modal already has a header-to-field auto-mapping step).
 *
 * Not handled (intentionally — out of scope):
 *   - Custom delimiters (always comma).
 *   - Comments (no `#` line skipping).
 *   - Streaming for >5MB files (UI rejects those upstream).
 */

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

const QUOTE = '"';
const DELIM = ",";

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/**
 * Lexes a single line of CSV (with quote-awareness) into an array of cell
 * values. Returns the row plus a `consumed` length so the caller can
 * advance over newlines that lived inside quoted fields.
 *
 * The state machine: at any character we're either inside a quoted field,
 * outside one, or transitioning. A doubled quote (`""`) inside a quoted
 * field is an escaped literal quote.
 */
function tokenizeRow(text: string, start: number): { cells: string[]; nextIndex: number } {
  const cells: string[] = [];
  let i = start;
  let cur = "";
  let inQuotes = false;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === QUOTE) {
        if (text[i + 1] === QUOTE) {
          cur += QUOTE;
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === QUOTE) {
      // Only treat as opening quote if it's at the start of the field.
      // Mid-cell quotes are taken literally — that's still nonsense input,
      // but we don't want to silently swallow it.
      if (cur === "") {
        inQuotes = true;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === DELIM) {
      cells.push(cur);
      cur = "";
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // CRLF — consume the \r and let the \n branch finish the row.
      if (text[i + 1] === "\n") {
        i += 1;
        continue;
      }
      // Bare \r — treat as line terminator.
      cells.push(cur);
      return { cells, nextIndex: i + 1 };
    }

    if (ch === "\n") {
      cells.push(cur);
      return { cells, nextIndex: i + 1 };
    }

    cur += ch;
    i += 1;
  }

  // EOF inside (or outside) the last cell.
  cells.push(cur);
  return { cells, nextIndex: i };
}

export function parseCsv(text: string): ParsedCsv {
  const stripped = stripBom(text);
  if (!stripped.trim()) return { headers: [], rows: [] };

  let i = 0;
  const len = stripped.length;
  const records: string[][] = [];

  while (i < len) {
    const { cells, nextIndex } = tokenizeRow(stripped, i);
    // Skip rows that are completely empty (single empty cell from a
    // blank line). A row with a real empty cell + commas still counts.
    const isBlank = cells.length === 1 && cells[0] === "";
    if (!isBlank) records.push(cells);
    i = nextIndex;
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0]!.map(h => h.trim());
  const rows = records.slice(1).map(record => {
    const out: Record<string, string> = {};
    headers.forEach((h, idx) => {
      // Preserve internal whitespace from quoted fields, but trim ends.
      out[h] = (record[idx] ?? "").trim();
    });
    return out;
  });

  return { headers, rows };
}
