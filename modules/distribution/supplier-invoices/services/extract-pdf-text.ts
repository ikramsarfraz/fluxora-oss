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

export type PdfExtraction = {
  combinedText: string;
  pageCount: number;
  charCount: number;
  hasUsableText: boolean;
};

const MIN_CHARS_FOR_TEXT_MODE = 200;
const Y_TOLERANCE = 3; // points; rows with baselines closer than this merge
const COLUMN_GAP = 10; // points; horizontal gaps wider than this become tabs

type Span = {
  text: string;
  x: number;
  y: number;
  width: number;
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

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // pdfjs reports y in PDF coordinates (origin bottom-left). Flip to top-
    // down to make row grouping intuitive: smaller y = nearer the top.
    const spans: Span[] = [];
    for (const it of content.items) {
      if (!isTextItem(it)) continue;
      const trimmed = it.str.trim();
      if (!trimmed) continue;
      spans.push({
        text: it.str,
        x: it.transform[4],
        y: viewport.height - it.transform[5],
        width: it.width,
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
        return line.trim();
      })
      .filter(line => line.length > 0);

    pageTexts.push(`--- Page ${i} ---\n${lines.join("\n")}`);
  }

  const combinedText = pageTexts.join("\n\n");
  return {
    combinedText,
    pageCount: pdf.numPages,
    charCount: combinedText.length,
    hasUsableText: combinedText.length >= MIN_CHARS_FOR_TEXT_MODE,
  };
}
