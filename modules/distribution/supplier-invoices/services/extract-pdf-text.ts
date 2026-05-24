import "server-only";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// ---------------------------------------------------------------------------
// Layout-preserving PDF text extraction for the text-first parse path.
//
// `pdf-parse` (the package the legacy pipeline relies on) collapses every
// text run into a single stream — line-item tables become a flat sequence
// of unlabeled tokens and the model has no chance of reconstructing which
// number is the weight, the rate, or the total. This module uses
// `pdfjs-dist` directly so we can group runs by Y coordinate (rows) and
// sort within a row by X coordinate (columns), inserting tabs where the
// horizontal gap is wide enough to imply a column boundary.
//
// Output format is intentionally line-and-tab structured:
//   --- Page 1 ---
//   QTY \t DESCRIPTION         \t WEIGHT \t RATE \t AMOUNT
//   4   \t CHICKEN TENDERS     \t 160.00 \t 1.00 \t 160.00
//   1   \t BRISKET SHORT RIBS  \t  69.05 \t 1.00 \t  69.05
//
// The prompts know to read tabs as column separators.
// ---------------------------------------------------------------------------

export type PdfRowBbox = {
  /** 1-based page index. */
  page: number;
  /** Top-left x in PDF user-space points (origin top-left). */
  x: number;
  /** Top-left y. */
  y: number;
  width: number;
  height: number;
};

/**
 * A single visual row of text on the PDF, with the text content joined the
 * same way `combinedText` joins it (tabs at column breaks). Used downstream to
 * map a parsed `UnresolvedLine` back to its on-page rectangle so the Review
 * screen's bidirectional highlight can outline it.
 */
export type PdfRow = {
  text: string;
  bbox: PdfRowBbox;
};

export type PdfExtraction = {
  combinedText: string;
  pageCount: number;
  charCount: number;
  hasUsableText: boolean;
  /** Per-visual-row metadata + bounding box, parallel to `combinedText`'s rows. */
  rows: PdfRow[];
};

const MIN_CHARS_FOR_TEXT_MODE = 200;
const Y_TOLERANCE = 3; // points; rows with baselines closer than this merge
const COLUMN_GAP = 10; // points; horizontal gaps wider than this become tabs

type Span = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function isTextItem(it: unknown): it is TextItem {
  return (
    typeof it === "object" &&
    it !== null &&
    "str" in it &&
    typeof (it as { str: unknown }).str === "string"
  );
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  const pdf = await getDocument({
    data: bytes,
    // Worker fetch is irrelevant server-side and trips up the bundler.
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];
  const collectedRows: PdfRow[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // pdfjs reports y in PDF coordinates (origin bottom-left). Flip to top-
    // down to make row grouping intuitive: smaller y = nearer the top.
    // We also carry `height` so each row can produce a real bounding box for
    // the Review screen's bbox overlay.
    const spans: Span[] = [];
    for (const it of content.items) {
      if (!isTextItem(it)) continue;
      const trimmed = it.str.trim();
      if (!trimmed) continue;
      spans.push({
        text: it.str,
        x: it.transform[4],
        // y is the *baseline* distance from the top after flipping; the top
        // of the glyph is at `y - height`. We use that when building bboxes.
        y: viewport.height - it.transform[5],
        width: it.width,
        height: it.height,
      });
    }
    spans.sort((a, b) => a.y - b.y || a.x - b.x);

    // Group spans into rows whose baselines are within Y_TOLERANCE.
    const rows: Span[][] = [];
    for (const span of spans) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].y - span.y) < Y_TOLERANCE) {
        row.push(span);
      } else {
        rows.push([span]);
      }
    }

    const lines = rows
      .map(row => {
        // Sort columns left-to-right, then walk and emit tabs where the
        // horizontal gap to the previous span looks like a column break.
        const sorted = [...row].sort((a, b) => a.x - b.x);
        let line = "";
        for (let j = 0; j < sorted.length; j++) {
          const span = sorted[j];
          if (j === 0) {
            line += span.text;
            continue;
          }
          const prev = sorted[j - 1];
          const gap = span.x - (prev.x + prev.width);
          line += (gap > COLUMN_GAP ? "\t" : " ") + span.text;
        }
        const text = line.trim();
        if (text.length > 0) {
          collectedRows.push({
            text,
            bbox: rowToBbox(sorted, i),
          });
        }
        return text;
      })
      .filter(line => line.length > 0);

    pageTexts.push(`--- Page ${i} ---\n${lines.join("\n")}`);
  }

  const combinedText = pageTexts.join("\n\n");
  const result = {
    combinedText,
    pageCount: pdf.numPages,
    charCount: combinedText.length,
    hasUsableText: combinedText.length >= MIN_CHARS_FOR_TEXT_MODE,
    rows: collectedRows,
  };

  // Tear down the PDFDocumentProxy so pdfjs-dist releases its per-document
  // worker state. Without this, parsing N PDFs in the same process (e.g. a
  // bulk import loop) can leak document state between calls and — in some
  // pdfjs versions — return stale-looking text on subsequent extractions.
  // We swallow errors: cleanup failure mustn't fail the parse.
  try {
    await pdf.cleanup();
    await pdf.destroy();
  } catch {
    /* defensive cleanup — ignore */
  }

  return result;
}

function rowToBbox(sortedSpans: Span[], page: number): PdfRowBbox {
  let minX = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBaseline = -Infinity;
  for (const span of sortedSpans) {
    if (span.x < minX) minX = span.x;
    if (span.x + span.width > maxRight) maxRight = span.x + span.width;
    const top = span.y - span.height;
    if (top < minTop) minTop = top;
    if (span.y > maxBaseline) maxBaseline = span.y;
  }
  return {
    page,
    x: minX,
    y: minTop,
    width: Math.max(0, maxRight - minX),
    height: Math.max(0, maxBaseline - minTop),
  };
}
