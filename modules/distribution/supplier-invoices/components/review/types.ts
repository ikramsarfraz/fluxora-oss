export type FieldConfidenceStatus = "warn" | "auto";

export type ConfidenceLevel = "high" | "medium" | "low";

export type SupplierCandidate = {
  name: string;
  /** 0–100. */
  score: number;
};

export type SupplierField = {
  value: string;
  /** 0–100. */
  confidence: number;
  matched: boolean;
  candidates: SupplierCandidate[];
};

export type TextField = {
  value: string;
  /** 0–100. */
  confidence: number;
  /** Optional source/explanation, e.g. "defaulted to invoice date". */
  note?: string;
};

export type AmountField = {
  value: number;
  confidence: number;
};

export type ParsedHeader = {
  supplier: SupplierField;
  invoiceNumber: TextField;
  invoiceDate: TextField;
  receiveDate: TextField;
  total: AmountField;
};

export type LineMatchStatus = "matched" | "unmatched" | "fee";

export type ProductCandidate = {
  name: string;
  sku: string;
  /** 0–100. */
  score: number;
};

export type LineMatch =
  | {
      status: "matched";
      product: string;
      sku: string;
      score: number;
      candidates: ProductCandidate[];
      /** Set when the match was made but its confidence is low (treat as warn). */
      warning?: string;
    }
  | {
      status: "unmatched";
      candidates: ProductCandidate[];
    }
  | {
      status: "fee";
      candidates: ProductCandidate[];
    };

export type ParsedLine = {
  id: number;
  raw: string;
  /**
   * Optional secondary description shown as muted text under `raw`. Comes from
   * a separate Description column on the invoice (when present) — kept apart
   * from the product name so alias keys stay clean. Null/undefined when the
   * invoice has no description column or the AI didn't surface one.
   */
  description?: string | null;
  cases: number;
  weight: number;
  unitPrice: number;
  total: number;
  /** Case-priced rather than weight-priced. */
  fixed?: boolean;
  match: LineMatch;
};

/**
 * One row per matched line whose unit price has moved more than a small
 * threshold since the supplier's previous invoice for the same product.
 * Powers the price-change banner above the line items list.
 */
export type ParsedPriceDeviation = {
  productId: string;
  productName: string;
  parsedUnitPrice: number;
  lastUnitPrice: number;
  /** Signed delta as percent — positive when price went up. */
  deviationPct: number;
  /** Date of the last invoice we're comparing against. */
  lastInvoiceDate: string;
};

export type ReviewData = {
  fileName: string;
  page: number;
  pages: number;
  size: string;
  parsed: ParsedHeader;
  lines: ParsedLine[];
  /** Optional. Empty when the parser found nothing notable. */
  priceDeviations: ParsedPriceDeviation[];
};

export type ReviewFilter = "needs" | "matched" | "fees" | "all";

export type ReviewCounts = {
  matched: number;
  needsReview: number;
  fees: number;
  total: number;
};

export function confidenceLevel(pct: number, status?: FieldConfidenceStatus): ConfidenceLevel {
  if (status === "warn") return "low";
  if (pct >= 80) return "high";
  if (pct >= 50) return "medium";
  return "low";
}

export function lineTone(
  match: LineMatch,
): "good" | "warn" | "danger" | "fee" {
  if (match.status === "fee") return "fee";
  if (match.status === "matched") return match.warning ? "warn" : "good";
  return "danger";
}

export function lineNeedsReview(match: LineMatch): boolean {
  if (match.status === "fee") return false;
  if (match.status === "unmatched") return true;
  return !!match.warning;
}
