// Pure helpers — no server-only import, no DB, no AI. Reachable from tests.

/**
 * Splits the layout-preserving text emitted by `extractPdfText` (one page
 * per `--- Page N ---` marker) into one or more invoice segments. Used by
 * the bulk-import flow (#224) so a "month-end bundle" PDF — many invoices
 * concatenated into a single file — gets fanned out into N parse passes
 * instead of being collapsed into a single Frankenstein bill by the
 * "combine all pages" rule in the AI prompts.
 *
 * Conservative on purpose:
 *
 *   - Only splits when we find 2+ distinct invoice numbers, each in the
 *     top header of the page it appears on.
 *   - A page with no recognisable invoice number is appended to the
 *     PREVIOUS segment (continuation pages: line-item overflow, totals
 *     block on its own page, etc.).
 *   - When fewer than 2 distinct numbers turn up, returns a single
 *     segment that covers the whole document — the caller then runs the
 *     existing single-invoice pipeline unchanged.
 *
 * Returning a single segment is the safe default: it preserves today's
 * behaviour for ordinary one-invoice-per-file uploads and means a flaky
 * heuristic can't actively make things worse. Multi-invoice uploads
 * unambiguous enough to clear the threshold are the only case that ends
 * up taking the new fan-out path.
 */

export type InvoiceSegment = {
  /** 1-based page range, inclusive. */
  startPage: number;
  endPage: number;
  /** The concatenated page text for this segment, with `--- Page N ---`
   *  markers preserved so the downstream parser sees the same shape it
   *  always has. */
  text: string;
  /** The detected invoice number that opened this segment, when one was
   *  recognisable. Null on the segment-with-no-detection fallback. */
  detectedInvoiceNumber: string | null;
};

const PAGE_MARKER_REGEX = /^--- Page (\d+) ---$/;
/**
 * How many characters from the top of the page count as the "header".
 * Invoice numbers in the body of a long line-item table are commonly
 * "Continued from #..." style cross-references that we don't want
 * driving a split. 500 chars is roughly the top 8-12 typeset lines —
 * enough to catch the actual header block, tight enough to ignore body.
 */
const HEADER_CHAR_WINDOW = 500;
/**
 * Match an invoice-number marker followed by the actual number.
 * The number can be digits with optional dashes / dots / letters, but
 * it must contain at least one digit and be ≥3 chars — otherwise a
 * page-numbering footer ("Inv 1") would trigger a false split.
 */
const INVOICE_NUMBER_REGEX =
  /\b(?:invoice|inv)\s*(?:no\.?|number|#|:)?[\s.:#-]*([A-Z0-9][A-Z0-9.-]{2,15})\b/i;
/**
 * Some patterns we DON'T want to lock onto as invoice numbers — they're
 * usually field labels or footer text that happen to follow a regex
 * match. Keep this list short and high-signal.
 */
const INVALID_NUMBER_TOKENS = new Set([
  "NUMBER",
  "DATE",
  "TOTAL",
  "AMOUNT",
  "BALANCE",
  "DUE",
]);

function looksLikeRealInvoiceNumber(candidate: string): boolean {
  const upper = candidate.toUpperCase();
  if (INVALID_NUMBER_TOKENS.has(upper)) return false;
  // Must contain at least one digit. A label like "RECEIPT" or "PROFORMA"
  // would otherwise sneak through the length check.
  if (!/\d/.test(candidate)) return false;
  return true;
}

/**
 * Extract the (probable) invoice number from the top of a page's text.
 * Returns null when no convincing match exists. Treats every match as
 * a candidate and picks the first one that survives the validity guard.
 */
export function detectInvoiceNumberInPageHeader(pageText: string): string | null {
  const header = pageText.slice(0, HEADER_CHAR_WINDOW);
  // Walk every match in the header window — the first valid candidate
  // wins. RegExp#exec in a loop preserves the index so we can keep
  // scanning past discarded matches without recompiling the pattern.
  const re = new RegExp(INVOICE_NUMBER_REGEX, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    const candidate = m[1]?.trim();
    if (candidate && looksLikeRealInvoiceNumber(candidate)) {
      return candidate.toUpperCase();
    }
  }
  return null;
}

/**
 * Split the `--- Page N ---`-formatted combinedText into per-page chunks.
 * Returns `[{ pageNumber, text }]` where `text` is everything that
 * appeared between this page's marker and the next one (or end-of-input).
 * Exported for tests so the marker-parsing contract is pinned.
 */
export function splitByPageMarkers(
  combinedText: string,
): Array<{ pageNumber: number; text: string }> {
  const lines = combinedText.split("\n");
  const pages: Array<{ pageNumber: number; text: string }> = [];
  let currentPage: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentPage != null) {
      pages.push({ pageNumber: currentPage, text: buffer.join("\n") });
    }
  };

  for (const line of lines) {
    const match = PAGE_MARKER_REGEX.exec(line);
    if (match) {
      flush();
      currentPage = Number(match[1]);
      buffer = [line];
    } else if (currentPage != null) {
      buffer.push(line);
    }
    // Lines before any page marker are dropped — the extractor always
    // emits at least one `--- Page 1 ---` marker for a parseable PDF,
    // so this only applies to empty / unparseable input where there's
    // nothing useful to keep anyway.
  }
  flush();
  return pages;
}

/**
 * Build invoice segments from layout-preserving text. See file-level
 * comment for the conservative-by-default contract.
 */
export function detectInvoiceSegments(
  combinedText: string,
): InvoiceSegment[] {
  const pages = splitByPageMarkers(combinedText);
  if (pages.length === 0) {
    return [
      {
        startPage: 1,
        endPage: 1,
        text: combinedText,
        detectedInvoiceNumber: null,
      },
    ];
  }

  // First pass: pick out invoice numbers per page.
  const annotated = pages.map(p => ({
    ...p,
    invoiceNumber: detectInvoiceNumberInPageHeader(p.text),
  }));

  // Count distinct invoice numbers across the whole document. If we don't
  // find at least two, there's nothing to fan out — collapse to a single
  // segment.
  const distinctNumbers = new Set(
    annotated.map(p => p.invoiceNumber).filter((n): n is string => n != null),
  );
  if (distinctNumbers.size < 2) {
    return [
      {
        startPage: annotated[0].pageNumber,
        endPage: annotated[annotated.length - 1].pageNumber,
        text: combinedText,
        detectedInvoiceNumber:
          annotated.find(p => p.invoiceNumber)?.invoiceNumber ?? null,
      },
    ];
  }

  // Walk the pages; start a new segment whenever an invoice number on
  // the current page differs from the segment we're currently building.
  // Pages with no detected number stick to the open segment as
  // continuation pages.
  const segments: InvoiceSegment[] = [];
  let currentStart = annotated[0].pageNumber;
  let currentBuffer: string[] = [annotated[0].text];
  let currentNumber: string | null = annotated[0].invoiceNumber;
  let currentEnd = annotated[0].pageNumber;

  const flushSegment = () => {
    segments.push({
      startPage: currentStart,
      endPage: currentEnd,
      text: currentBuffer.join("\n\n"),
      detectedInvoiceNumber: currentNumber,
    });
  };

  for (let i = 1; i < annotated.length; i++) {
    const p = annotated[i];
    const isNewInvoice =
      p.invoiceNumber != null &&
      currentNumber != null &&
      p.invoiceNumber !== currentNumber;
    // A page with a detected number that matches our current segment
    // continues it; a page with no number always continues; a page with
    // a different number opens a new segment.
    if (isNewInvoice) {
      flushSegment();
      currentStart = p.pageNumber;
      currentBuffer = [p.text];
      currentNumber = p.invoiceNumber;
      currentEnd = p.pageNumber;
      continue;
    }
    // First detection on a previously-numberless segment — adopt it.
    if (currentNumber == null && p.invoiceNumber != null) {
      currentNumber = p.invoiceNumber;
    }
    currentBuffer.push(p.text);
    currentEnd = p.pageNumber;
  }
  flushSegment();

  return segments;
}
