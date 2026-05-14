import type { SupplierInvoicePdfPrefillResult } from "./pdf-prefill";

export type ParsedConfidenceBreakdown = {
  invoiceNumberFound: boolean;
  invoiceDateFound: boolean;
  supplierMatched: boolean;
  linesExtracted: boolean;
  totalsMatch: boolean | null;
  unmatchedProductRatio: number;
  score: number;
};

const CONFIDENCE_WEIGHTS = {
  invoiceNumber: 20,
  invoiceDate: 20,
  supplierMatched: 20,
  linesExtracted: 20,
  totalsMatch: 15,
  allProductsMatched: 5,
} as const;

export function scoreParseResult(
  result: SupplierInvoicePdfPrefillResult,
): ParsedConfidenceBreakdown {
  const invoiceNumberFound = Boolean(result.values.invoiceNumber);
  // The deterministic parser and AI merge now leave invoiceDate as an empty
  // string when no date could be extracted, so a direct truthiness check is
  // sufficient — no need to grep warnings.
  const invoiceDateFound = Boolean(result.values.invoiceDate);
  const supplierMatched = Boolean(result.values.supplierId);
  // linesExtracted = at least one vendor line was found (matched or unmatched).
  // Product resolution is a separate dimension scored via unmatchedProductRatio.
  const linesExtracted =
    result.values.lines.length > 0 &&
    (
      result.values.lines.some(l => l.productId !== "") ||
      result.unmatchedLineDescriptions.length > 0
    );
  const totalsMatch = result.totalComparison.matches;

  const totalLines = result.values.lines.length;
  const unmatchedCount = result.unmatchedLineDescriptions.length;
  const unmatchedRatio = totalLines > 0 ? unmatchedCount / totalLines : 1;

  let score = 0;
  if (invoiceNumberFound) score += CONFIDENCE_WEIGHTS.invoiceNumber;
  if (invoiceDateFound) score += CONFIDENCE_WEIGHTS.invoiceDate;
  if (supplierMatched) score += CONFIDENCE_WEIGHTS.supplierMatched;
  if (linesExtracted) score += CONFIDENCE_WEIGHTS.linesExtracted;
  if (totalsMatch === true) score += CONFIDENCE_WEIGHTS.totalsMatch;
  else if (totalsMatch === null) score += Math.round(CONFIDENCE_WEIGHTS.totalsMatch * 0.5);
  if (unmatchedRatio === 0) score += CONFIDENCE_WEIGHTS.allProductsMatched;
  else score += Math.round(CONFIDENCE_WEIGHTS.allProductsMatched * (1 - unmatchedRatio));

  return {
    invoiceNumberFound,
    invoiceDateFound,
    supplierMatched,
    linesExtracted,
    totalsMatch,
    unmatchedProductRatio: unmatchedRatio,
    score: Math.min(100, Math.max(0, score)),
  };
}

const MIN_TEXT_LENGTH_FOR_PARSED_PDF = 20;

export function detectScannedPdf(extractedText: string, pdfPageCount = 1): boolean {
  const trimmed = extractedText.trim();
  if (trimmed.length < MIN_TEXT_LENGTH_FOR_PARSED_PDF) return true;
  const charsPerPage = trimmed.length / Math.max(pdfPageCount, 1);
  return charsPerPage < 50 && pdfPageCount > 0;
}
