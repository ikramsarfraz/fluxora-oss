/**
 * Convert a parsed `PipelineResult` (the shape the OCR/AI pipeline produces)
 * into the `ReviewData` shape the new review screen renders against.
 *
 * The mapping is presentational only — every field becomes editable in the
 * review UI, so we lean on the parser's confidence numbers + candidate lists
 * to drive tone/badges and don't try to re-derive anything that isn't already
 * in the pipeline result.
 */

import type { PipelineResult, UnresolvedLine } from "../../services/parsing-pipeline";
import type { SupplierInvoicePdfPrefillLine } from "../../utils/pdf-prefill";

import type { LineBbox } from "./line-bbox";
import type {
  ParsedHeader,
  ParsedLine,
  ProductCandidate,
  ReviewData,
  SupplierCandidate,
} from "./types";

export type ProductLookup = {
  id: string;
  name: string;
  sku: string | null;
};

export type SupplierLookup = {
  id: string;
  name: string;
};

export type MapPipelineInput = {
  fileName: string;
  pipeline: PipelineResult;
  products: ProductLookup[];
  suppliers: SupplierLookup[];
  /** Filesize string shown in the header chip, e.g. "455.9 KB". */
  fileSize?: string;
  pages?: number;
};

const HIGH_CONFIDENCE = 90;
const MEDIUM_CONFIDENCE = 65;

function findSupplier(
  suppliers: SupplierLookup[],
  id: string,
): SupplierLookup | null {
  return suppliers.find(s => s.id === id) ?? null;
}

function findProduct(
  products: ProductLookup[],
  id: string,
): ProductLookup | null {
  return products.find(p => p.id === id) ?? null;
}

function toSupplierCandidates(
  unmatchedNames: string[],
): SupplierCandidate[] {
  // The pipeline surfaces names it couldn't match deterministically. We can't
  // score them here without rerunning the fuzzy matcher, so the score is
  // omitted; the review UI just shows the names as suggestions to type into
  // the supplier field.
  return unmatchedNames.slice(0, 4).map(name => ({
    name,
    score: 0,
  }));
}

function buildHeader({
  pipeline,
  suppliers,
}: {
  pipeline: PipelineResult;
  suppliers: SupplierLookup[];
}): ParsedHeader {
  const values = pipeline.prefillResult.values;
  const breakdown = pipeline.confidenceBreakdown;

  // The pipeline's ParsedConfidenceBreakdown is boolean flags + an overall
  // score, not per-field 0–100s. Derive presentational confidence numbers
  // from the flags so the per-field chips reflect "did the parser find it?".
  const supplierMatch = values.supplierId
    ? findSupplier(suppliers, values.supplierId)
    : null;
  const supplierDisplayName =
    supplierMatch?.name ??
    pipeline.prefillResult.unmatchedSupplierCandidates[0] ??
    "";

  const supplierConfidence = breakdown.supplierMatched
    ? HIGH_CONFIDENCE
    : supplierDisplayName
      ? 40
      : 0;
  const invoiceNumberConfidence = breakdown.supplierInvoiceNumberFound ? 95 : 0;
  const invoiceDateConfidence = breakdown.invoiceDateFound ? 95 : 0;
  const receiveDateConfidence =
    values.receiveDate === values.invoiceDate ? MEDIUM_CONFIDENCE : invoiceDateConfidence;
  const totalConfidence =
    pipeline.prefillResult.totalComparison.matches === true ? HIGH_CONFIDENCE : 80;

  const totalNumeric = Number(pipeline.prefillResult.totalComparison.extractedTotal) || 0;

  return {
    supplier: {
      value: supplierDisplayName,
      confidence: supplierConfidence,
      matched: !!supplierMatch,
      candidates: toSupplierCandidates(
        pipeline.prefillResult.unmatchedSupplierCandidates,
      ),
    },
    invoiceNumber: {
      value: values.supplierInvoiceNumber,
      confidence: invoiceNumberConfidence,
    },
    invoiceDate: {
      value: values.invoiceDate,
      confidence: invoiceDateConfidence,
    },
    receiveDate: {
      value: values.receiveDate,
      confidence: receiveDateConfidence,
      note: values.receiveDate === values.invoiceDate ? "defaulted to invoice date" : undefined,
    },
    total: {
      value: totalNumeric,
      confidence: totalConfidence,
    },
  };
}

function toProductCandidate(
  candidate: { id: string; name: string; score: number },
  products: ProductLookup[],
): ProductCandidate {
  const product = findProduct(products, candidate.id);
  return {
    name: candidate.name,
    sku: product?.sku ?? "",
    score: Math.round(candidate.score),
  };
}

function buildLines({
  pipeline,
  products,
}: {
  pipeline: PipelineResult;
  products: ProductLookup[];
}): ParsedLine[] {
  const prefillLines = pipeline.prefillResult.values.lines;
  const unresolved = pipeline.unresolvedLines;
  const feeDescriptions = new Set(
    pipeline.detectedFees.map(f => f.description.toLowerCase()),
  );

  const productLines = prefillLines.map((line, index) =>
    buildLine({
      index,
      line,
      unresolved: unresolved[index] ?? null,
      products,
      feeDescriptions,
    }),
  );

  // Append fee rows (delivery charges, cut fees, etc.). These come from the
  // pipeline's `detectedFees` channel and aren't part of `prefillLines`. We
  // synthesize a ParsedLine per fee so they render in the line list with the
  // existing fee styling and surface via the new "Fees" filter tab.
  const feeLines: ParsedLine[] = pipeline.detectedFees.map((fee, i) => ({
    id: productLines.length + i + 1,
    raw: fee.description,
    cases: 1,
    weight: 0,
    unitPrice: fee.amount,
    total: fee.amount,
    fixed: true,
    match: { status: "fee", candidates: [] },
  }));

  return [...productLines, ...feeLines];
}

function buildLine({
  index,
  line,
  unresolved,
  products,
  feeDescriptions,
}: {
  index: number;
  line: SupplierInvoicePdfPrefillLine;
  unresolved: UnresolvedLine | null;
  products: ProductLookup[];
  feeDescriptions: Set<string>;
}): ParsedLine {
  const cases = Number(line.quantityCases) || 0;
  const weight = Number(line.weightLbs) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const total =
    line.unitType === "catch_weight" ? weight * unitPrice : cases * unitPrice;

  const product = line.productId ? findProduct(products, line.productId) : null;
  const rawText = unresolved?.vendorProductName ?? product?.name ?? `Line ${index + 1}`;
  const description = unresolved?.vendorProductDescription ?? null;
  const isFee = feeDescriptions.has(rawText.toLowerCase());

  if (isFee) {
    return {
      id: index + 1,
      raw: rawText,
      description,
      cases,
      weight,
      unitPrice,
      total,
      fixed: line.unitType === "fixed_case",
      match: { status: "fee", candidates: [] },
    };
  }

  // Already matched to a catalog product → render as "Matched".
  if (product && line.productId) {
    const aiScore =
      unresolved?.aiSuggestion?.confidence ?? unresolved?.confidence ?? null;
    const score = aiScore != null ? Math.round(aiScore) : HIGH_CONFIDENCE;
    const warning = score < MEDIUM_CONFIDENCE ? "Low confidence — review" : undefined;
    return {
      id: index + 1,
      raw: rawText,
      description,
      cases,
      weight,
      unitPrice,
      total,
      fixed: line.unitType === "fixed_case",
      match: {
        status: "matched",
        product: product.name,
        sku: product.sku ?? "",
        score,
        candidates: (unresolved?.topCandidates ?? []).map(c =>
          toProductCandidate(c, products),
        ),
        warning,
      },
    };
  }

  // No productId → unmatched. Candidates come from the AI suggestions.
  return {
    id: index + 1,
    raw: rawText,
    description,
    cases,
    weight,
    unitPrice,
    total,
    fixed: line.unitType === "fixed_case",
    match: {
      status: "unmatched",
      candidates: (unresolved?.topCandidates ?? []).map(c =>
        toProductCandidate(c, products),
      ),
    },
  };
}

export function mapPipelineToReviewData(input: MapPipelineInput): ReviewData {
  const {
    fileName,
    pipeline,
    products,
    suppliers,
    fileSize = "",
    pages = 1,
  } = input;

  return {
    fileName,
    page: 1,
    pages,
    size: fileSize,
    parsed: buildHeader({ pipeline, suppliers }),
    lines: buildLines({ pipeline, products }),
    // `priceDeviations` is computed server-side per matched line — we just
    // pass the shape through unchanged. Empty list means nothing notable.
    priceDeviations: pipeline.priceDeviations.map(d => ({
      productId: d.productId,
      productName: d.productName,
      parsedUnitPrice: d.parsedUnitPrice,
      lastUnitPrice: d.lastUnitPrice,
      deviationPct: d.deviationPct,
      lastInvoiceDate: d.lastInvoiceDate,
    })),
  };
}

/**
 * Extract per-line bounding boxes from a PipelineResult. Returns empty when
 * the parser hasn't recorded any — the BboxOverlay simply renders nothing in
 * that case and the fake-invoice fallback's tr-based highlight still works.
 */
export function mapPipelineToLineBboxes(pipeline: PipelineResult): LineBbox[] {
  const out: LineBbox[] = [];
  for (let i = 0; i < pipeline.unresolvedLines.length; i++) {
    const u = pipeline.unresolvedLines[i];
    if (!u.bbox) continue;
    out.push({
      lineId: i + 1,
      page: u.bbox.page,
      x: u.bbox.x,
      y: u.bbox.y,
      width: u.bbox.width,
      height: u.bbox.height,
    });
  }
  return out;
}
