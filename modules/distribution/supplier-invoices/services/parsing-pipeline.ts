import "server-only";

import { eq, and, isNull, inArray, desc, ne } from "drizzle-orm";

import { db } from "@/db";
import { products, suppliers, productCategories, categories, supplierInvoices, supplierInvoiceLines } from "@/db/schema";
import {
  parseSupplierInvoicePdfText,
  type SupplierInvoicePdfPrefillResult,
  type SupplierInvoicePdfPrefillLine,
} from "../utils/pdf-prefill";
import { normalizeProductName } from "../utils/normalization";
import {
  scoreParseResult,
  detectScannedPdf,
  type ParsedConfidenceBreakdown,
} from "../utils/pipeline-scoring";
import { scoreVisionExtraction, isVisionExtractionUseful, type VisionExtractionScore } from "../utils/vision-scoring";
import { correctVisionColumnSwap } from "../utils/vision-correction";
import { extractSupplierInvoiceWithAi } from "./ai-extraction";
import { extractSupplierInvoiceWithVision, type VisionExtractionResult } from "./ai-vision";
import { detectImportProfile } from "./import-profiles";
import {
  matchProductsMultiStage,
  resolveAliasesForTenant,
  type ProductMatchCandidate,
} from "./product-matching";
import {
  applyAliasesToLines,
  applyMatchResultsToLines,
  buildProfileKeywords,
  type LineMatchEntry,
} from "../utils/parsing-pipeline-logic";
import {
  mergeAiOverDeterministic as mergeAiOverDeterministicPure,
  mergeVisionOverResult as mergeVisionOverResultPure,
} from "../utils/ai-merge";
import { buildFormStateWarnings } from "../utils/form-state-warnings";

export { scoreParseResult, detectScannedPdf };
export type { ParsedConfidenceBreakdown };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineParseSource = "deterministic" | "ai_fallback" | "hybrid" | "vision";

export type UnresolvedLine = {
  vendorProductName: string;
  suggestedProductId: string | null;
  confidence: number;
  stage: string;
  reasoning: string;
  aiSuggestionPending: boolean;
  topCandidates?: Array<{ id: string; name: string; score: number }>;
  aiSuggestion?: { productId: string | null; confidence: number } | null;
};

type LineSnapshot = {
  quantityWeight: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
};

export type PipelineDebugInfo = {
  deterministicLineCount: number;
  aiTextLineCount: number;
  aiTextFirstLine: LineSnapshot | null;
  mergedLineCount: number;
  mergedTotalsMatch: boolean | null;
  finalLineCount: number;
  extractedInvoiceTotal: string | null;
  visionAttempted: boolean;
  visionWorthUsing: boolean;
  visionLineCount: number;
  visionFirstLine: LineSnapshot | null;
  rawVisionJson: string;
  visionScore: VisionExtractionScore | null;
};

export type DetectedFee = { description: string; amount: number };

export type PriceDeviation = {
  productId: string;
  productName: string;
  parsedUnitPrice: number;
  lastUnitPrice: number;
  deviationPct: number;
  lastInvoiceDate: string;
};

const PRICE_DEVIATION_THRESHOLD_PCT = 5;

export type FirstBillLine = {
  rawVendorText: string;
  suggestedName: string;
  quantityCases: string;
  weightLbs: string;
  unitPrice: string;
  unitType: "catch_weight" | "fixed_case";
};

/**
 * Telemetry about how the PDF text was obtained — populated by the entry
 * point (parseSupplierInvoicePdf), not by runParsingPipeline itself.
 *
 *   mode:          PARSE_MODE flag — "text-first" tries pdfjs-dist layout
 *                  extraction before falling through to pdf-parse / vision.
 *   textExtractor: which text source was actually used (the text-first
 *                  branch falls back to pdf-parse when pdfjs yields too
 *                  little).
 *   textCharCount: characters fed into the AI text path — useful to spot
 *                  invoices that bypass the text path entirely.
 */
export type PipelineTelemetry = {
  mode: "text-first" | "vision-only";
  textExtractor: "pdfjs-dist" | "pdf-parse";
  textCharCount: number;
};

export type PipelineResult = {
  prefillResult: SupplierInvoicePdfPrefillResult;
  confidence: number;
  confidenceBreakdown: ParsedConfidenceBreakdown;
  source: PipelineParseSource;
  aiUsed: boolean;
  requiresOcr: boolean;
  warnings: string[];
  unresolvedLines: UnresolvedLine[];
  detectedFees: DetectedFee[];
  priceDeviations: PriceDeviation[];
  detectedProfileId: string | null;
  proposedProfile: {
    supplierId: string;
    keywords: string[];
  } | null;
  visionUsed: boolean;
  debug?: PipelineDebugInfo;
  /** Populated only when the tenant catalog is empty (first-bill mode). */
  firstBillLines?: FirstBillLine[];
  telemetry?: PipelineTelemetry;
};

// ---------------------------------------------------------------------------
// Main pipeline entry point
// ---------------------------------------------------------------------------

export async function runParsingPipeline(args: {
  extractedText: string;
  sourceFilename: string;
  tenantId: string;
  pdfPageCount?: number;
  aiConfidenceThreshold?: number;
  pdfBytes?: Buffer;
  debug?: boolean;
  /** When true (empty catalog), skip all product matching and return firstBillLines. */
  firstBillMode?: boolean;
}): Promise<PipelineResult> {
  const {
    extractedText,
    sourceFilename,
    tenantId,
    pdfPageCount = 1,
    aiConfidenceThreshold = 60,
    pdfBytes,
    debug = false,
    firstBillMode = false,
  } = args;

  // Stage 0: scanned PDF detection
  if (detectScannedPdf(extractedText, pdfPageCount)) {
    return buildScannedPdfResult(sourceFilename);
  }

  // Load tenant data — products with their category names in one round-trip
  const [supplierRows, productRows, categoryRows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenantId)),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt))),
    db
      .select({ productId: productCategories.productId, categoryName: categories.name })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .innerJoin(products, eq(productCategories.productId, products.id))
      .where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt))),
  ]);

  // Build productId → categoryNames map
  const categoryMap = new Map<string, string[]>();
  for (const row of categoryRows) {
    const names = categoryMap.get(row.productId) ?? [];
    names.push(row.categoryName);
    categoryMap.set(row.productId, names);
  }

  // Enrich products with category names
  const richProductRows: ProductMatchCandidate[] = productRows.map(p => ({
    ...p,
    categoryNames: categoryMap.get(p.id),
  }));

  // Stage 1: deterministic parsing
  const deterministicResult = parseSupplierInvoicePdfText({
    text: extractedText,
    sourceFilename,
    suppliers: supplierRows,
    products: productRows,
  });

  const breakdown = scoreParseResult(deterministicResult);
  const supplierId = deterministicResult.values.supplierId || null;

  // Stage 2: import profile detection
  const detectedProfile = await detectImportProfile({
    tenantId,
    supplierId,
    extractedText,
    filename: sourceFilename,
  });

  const threshold = detectedProfile
    ? detectedProfile.confidenceThreshold
    : aiConfidenceThreshold;

  // If deterministic confidence is sufficient AND it extracted matched lines, skip AI/vision.
  // unmatchedProductRatio < 1 ensures invoices where vendor lines were found but no products
  // matched still fall through to AI — same effective gate as the original implementation.
  if (breakdown.score >= threshold && breakdown.linesExtracted && breakdown.unmatchedProductRatio < 1) {
    // Safety intercept: empty catalog should never reach here, but guard anyway.
    if (firstBillMode) {
      return buildFirstBillResult(deterministicResult, "deterministic", false, false);
    }
    const enriched = await enrichWithAliases(deterministicResult, tenantId, supplierId, richProductRows);
    const productNameMap = new Map(richProductRows.map(p => [p.id, p.name]));
    const priceDeviations = await detectPriceDeviations({
      tenantId,
      supplierId,
      lines: enriched.result.values.lines,
      productNames: productNameMap,
    });
    const finalized = applyFormStateWarnings(enriched.result, deterministicResult.warnings);
    return {
      prefillResult: finalized.result,
      confidence: breakdown.score,
      confidenceBreakdown: breakdown,
      source: "deterministic",
      aiUsed: false,
      requiresOcr: false,
      warnings: finalized.warnings,
      unresolvedLines: enriched.unresolvedLines,
      detectedFees: [],
      priceDeviations,
      detectedProfileId: detectedProfile?.id ?? null,
      proposedProfile: buildProposedProfile(deterministicResult, supplierRows),
      visionUsed: false,
    };
  }

  // Stage 3: AI text fallback
  const aiResult = await extractSupplierInvoiceWithAi({
    filename: sourceFilename,
    extractedText,
    supplierHints: deterministicResult.unmatchedSupplierCandidates,
    candidateSuppliers: supplierRows,
    candidateProducts: richProductRows,
  });

  const mergedResult = mergeAiOverDeterministicPure(deterministicResult, aiResult, supplierRows).result;
  const mergedBreakdown = scoreParseResult(mergedResult);

  // Stage 4: Vision fallback — triggered when AI text extraction produced no line items,
  // the merged totals don't reconcile (column data was lost in text extraction), or
  // confidence is still low after AI. Requires pdfBytes to be provided.
  const needsVision =
    pdfBytes !== undefined &&
    pdfBytes.byteLength > 0 &&
    (aiResult.lines.length === 0 ||
      mergedBreakdown.totalsMatch === false ||
      mergedBreakdown.score < 60);

  let visionResult: VisionExtractionResult | null = null;
  let visionScore: VisionExtractionScore | null = null;
  let visionWorthUsing = false;
  let finalResult = mergedResult;
  let finalBreakdown = mergedBreakdown;
  let visionUsed = false;

  if (needsVision && pdfBytes) {
    visionResult = await extractSupplierInvoiceWithVision({
      pdfBuffer: pdfBytes,
      filename: sourceFilename,
      extractedText,
      supplierHints: deterministicResult.unmatchedSupplierCandidates,
      candidateSuppliers: supplierRows,
      debug,
    });

    // Correct column-swap errors (e.g. Qty/Weight value read as Qty) before scoring.
    const columnFix = correctVisionColumnSwap(visionResult.lines, extractedText);
    if (columnFix.correctedCount > 0) {
      visionResult = {
        ...visionResult,
        lines: columnFix.lines,
        warnings: [...visionResult.warnings, ...columnFix.warnings],
      };
    }

    visionScore = scoreVisionExtraction(visionResult);

    const currentMeaningfulLines = countMeaningfulLines(mergedResult);

    // Primary gate: vision found strictly more lines than current.
    // Secondary gate: current totals don't reconcile (AI text lost weight/price columns)
    //   AND vision found at least as many lines AND vision's own totals are consistent.
    //   This covers the common case where AI text can read line totals from flat PDF text
    //   but can't recover the weight column — vision reads the table visually and gets it right.
    visionWorthUsing =
      isVisionExtractionUseful(visionScore, currentMeaningfulLines, visionResult.lines.length) ||
      (
        mergedBreakdown.totalsMatch === false &&
        visionResult.lines.length > 0 &&
        visionResult.lines.length >= currentMeaningfulLines &&
        visionScore.totalsReconcile !== false
      );

    if (visionWorthUsing) {
      finalResult = mergeVisionOverResultPure(mergedResult, visionResult, supplierRows).result;
      finalBreakdown = scoreParseResult(finalResult);
      visionUsed = true;
    }
  }

  if (debug) {
    const fmtLine = (l: { quantityWeight: number | null; unitPrice: number | null; lineTotal: number | null } | null) =>
      l ? `weight=${l.quantityWeight} price=${l.unitPrice} total=${l.lineTotal}` : "none";
    console.log("[pipeline debug]", {
      det: deterministicResult.values.lines.length,
      aiLines: aiResult.lines.length,
      aiFirst: fmtLine(aiResult.lines[0] ?? null),
      aiTotalAmount: aiResult.totalAmount,
      mergedLines: mergedResult.values.lines.length,
      mergedTotalsMatch: mergedBreakdown.totalsMatch,
      mergedComputedTotal: mergedResult.totalComparison.computedLineTotal,
      needsVision,
      visionLines: visionResult?.lines.length ?? 0,
      visionFirst: fmtLine(visionResult?.lines[0] ?? null),
      visionWorthUsing,
      visionUsed,
      finalLines: finalResult.values.lines.length,
      finalFirst: finalResult.values.lines[0]
        ? `weightLbs=${finalResult.values.lines[0].weightLbs} unitPrice=${finalResult.values.lines[0].unitPrice}`
        : "none",
    });
  }

  // First-bill mode: empty catalog — skip all product matching and return naming scaffolding.
  if (firstBillMode) {
    const source: PipelineParseSource = visionUsed
      ? "vision"
      : aiResult.lines.length > 0
        ? "ai_fallback"
        : "hybrid";
    return buildFirstBillResult(finalResult, source, true, visionUsed);
  }

  const enriched = await enrichWithAliasesAndAiMatching(
    finalResult,
    tenantId,
    finalResult.values.supplierId || null,
    richProductRows,
  );

  const productNameMap = new Map(richProductRows.map(p => [p.id, p.name]));
  const priceDeviations = await detectPriceDeviations({
    tenantId,
    supplierId: finalResult.values.supplierId || null,
    lines: enriched.result.values.lines,
    productNames: productNameMap,
  });

  // Warn when AI text parsed line totals but lost the weight column, vision
  // didn't recover anything, AND back-calc couldn't fill in weights either —
  // the form will show $0.00 until user fills weights manually.
  const finalCatchWeightLinesHaveZero =
    finalResult.values.lines.length > 0 &&
    finalResult.values.lines.every(
      l => l.unitType !== "catch_weight" || (Number(l.weightLbs) || 0) === 0,
    );
  const visionFailed = needsVision && (visionResult === null || visionResult.lines.length === 0);
  const nullWeightWarning =
    aiResult.lines.length > 0 &&
    aiResult.lines.every(l => (l.quantityWeight ?? 0) <= 0) &&
    finalCatchWeightLinesHaveZero &&
    mergedBreakdown.totalsMatch === false &&
    visionFailed
      ? "Weight column could not be recovered from this PDF — all line weights are 0. Enter weights manually before saving."
      : null;

  const sourceStageWarnings = [
    ...finalResult.warnings,
    ...(visionUsed ? [] : aiResult.warnings),
    ...(nullWeightWarning ? [nullWeightWarning] : []),
    "AI extraction was used — review all fields before saving.",
  ];
  const finalized = applyFormStateWarnings(enriched.result, sourceStageWarnings);

  const source: PipelineParseSource = visionUsed
    ? "vision"
    : aiResult.lines.length > 0
      ? "ai_fallback"
      : "hybrid";

  const aiFirstLine = aiResult.lines[0] ?? null;
  const visionFirstLine = visionResult?.lines[0] ?? null;

  const debugInfo: PipelineDebugInfo | undefined = debug
    ? {
        deterministicLineCount: deterministicResult.values.lines.length,
        aiTextLineCount: aiResult.lines.length,
        aiTextFirstLine: aiFirstLine
          ? { quantityWeight: aiFirstLine.quantityWeight, unitPrice: aiFirstLine.unitPrice, lineTotal: aiFirstLine.lineTotal }
          : null,
        mergedLineCount: mergedResult.values.lines.length,
        mergedTotalsMatch: mergedBreakdown.totalsMatch,
        finalLineCount: finalResult.values.lines.length,
        extractedInvoiceTotal:
          aiResult.totalAmount != null
            ? String(aiResult.totalAmount)
            : deterministicResult.totalComparison.extractedTotal,
        visionAttempted: needsVision,
        visionWorthUsing,
        visionLineCount: visionResult?.lines.length ?? 0,
        visionFirstLine: visionFirstLine
          ? { quantityWeight: visionFirstLine.quantityWeight, unitPrice: visionFirstLine.unitPrice, lineTotal: visionFirstLine.lineTotal }
          : null,
        rawVisionJson: visionResult?.rawVisionJson ?? "",
        visionScore,
      }
    : undefined;

  return {
    prefillResult: finalized.result,
    confidence: finalBreakdown.score,
    confidenceBreakdown: finalBreakdown,
    source,
    aiUsed: true,
    requiresOcr: false,
    warnings: finalized.warnings,
    unresolvedLines: enriched.unresolvedLines,
    detectedFees: visionUsed
      ? (visionResult?.fees ?? [])
      : aiResult.fees,
    priceDeviations,
    detectedProfileId: detectedProfile?.id ?? null,
    proposedProfile:
      (visionResult?.confidence ?? aiResult.confidence) >= 70
        ? buildProposedProfile(finalResult, supplierRows)
        : null,
    visionUsed,
    debug: debugInfo,
  };
}

// ---------------------------------------------------------------------------
// Final state finalizer — backfill date and append form-state warnings.
// ---------------------------------------------------------------------------

/**
 * Apply form-state warnings to the final prefill result. Backfills today's
 * date if the pipeline couldn't extract one, and returns a deduped warnings
 * list combining the source-stage warnings with the freshly evaluated
 * final-state warnings (so messages like "Supplier was not matched" only
 * appear when the FINAL result is actually missing a supplier).
 */
function applyFormStateWarnings(
  result: SupplierInvoicePdfPrefillResult,
  sourceStageWarnings: string[],
): { result: SupplierInvoicePdfPrefillResult; warnings: string[] } {
  const stateCheck = buildFormStateWarnings(result);

  const adjustedResult: SupplierInvoicePdfPrefillResult = stateCheck.invoiceDateUsedFallback
    ? {
        ...result,
        values: {
          ...result.values,
          invoiceDate: stateCheck.resolvedInvoiceDate,
          receiveDate: result.values.receiveDate || stateCheck.resolvedInvoiceDate,
        },
      }
    : {
        ...result,
        values: {
          ...result.values,
          // Make sure receiveDate is at least populated when we have a date.
          receiveDate: result.values.receiveDate || result.values.invoiceDate,
        },
      };

  return {
    result: adjustedResult,
    warnings: dedupeStrings([...sourceStageWarnings, ...stateCheck.warnings]),
  };
}

// ---------------------------------------------------------------------------
// Count meaningful lines (lines with a real price or weight)
// ---------------------------------------------------------------------------

function countMeaningfulLines(result: SupplierInvoicePdfPrefillResult): number {
  return result.values.lines.filter(
    l => Number(l.unitPrice) > 0 || (l.weightLbs && Number(l.weightLbs) > 0),
  ).length;
}

// ---------------------------------------------------------------------------
// Alias enrichment (deterministic path — fast, no AI)
// ---------------------------------------------------------------------------

async function enrichWithAliases(
  result: SupplierInvoicePdfPrefillResult,
  tenantId: string,
  supplierId: string | null,
  candidateProducts: ProductMatchCandidate[],
): Promise<{ result: SupplierInvoicePdfPrefillResult; unresolvedLines: UnresolvedLine[] }> {
  if (result.unmatchedLineDescriptions.length === 0) {
    return { result, unresolvedLines: [] };
  }

  // Alias lookup (requires a known supplier).
  const aliasMap: ReadonlyMap<string, string> = supplierId
    ? await resolveAliasesForTenant({ tenantId, supplierId })
    : new Map();

  const enrichedByAlias = applyAliasesToLines(
    result.values.lines,
    result.unmatchedLineDescriptions,
    aliasMap,
  );

  const unmatchedAfterAlias = result.unmatchedLineDescriptions.filter(desc => {
    return !aliasMap.has(normalizeProductName(desc));
  });

  // Alias-matched lines — build their unresolvedLine entries directly.
  const aliasResolvedLines: UnresolvedLine[] = result.unmatchedLineDescriptions
    .filter(name => aliasMap.has(normalizeProductName(name)))
    .map(name => ({
      vendorProductName: name,
      suggestedProductId: aliasMap.get(normalizeProductName(name)) ?? null,
      confidence: 95,
      stage: "normalized_alias" as const,
      reasoning: "Matched via saved alias.",
      aiSuggestionPending: false,
    }));

  // Fuzzy-match still-unmatched products against the full catalog.
  // No AI in the deterministic path — keeps the fast path fast.
  let finalLines = enrichedByAlias;
  let fuzzyLines: UnresolvedLine[] = [];

  if (unmatchedAfterAlias.length > 0 && candidateProducts.length > 0) {
    const matchResults = await matchProductsMultiStage({
      tenantId,
      supplierId,
      vendorProductNames: unmatchedAfterAlias,
      candidateProducts,
      useAiFallback: false,
    });

    const matchEntries = new Map<string, LineMatchEntry>();
    for (const m of matchResults) {
      matchEntries.set(m.vendorProductName, {
        productId: m.productId,
        confidence: m.confidence,
        aiSuggestionPending: m.aiSuggestionPending,
      });
    }

    ({ enrichedLines: finalLines } = applyMatchResultsToLines(
      enrichedByAlias,
      unmatchedAfterAlias,
      matchEntries,
    ));

    fuzzyLines = matchResults.map(m => ({
      vendorProductName: m.vendorProductName,
      suggestedProductId: m.productId,
      confidence: m.confidence,
      stage: m.stage,
      reasoning: m.reasoning,
      aiSuggestionPending: false,
      topCandidates: m.topCandidates,
    }));
  }

  return {
    result: {
      ...result,
      values: { ...result.values, lines: finalLines },
      unmatchedLineDescriptions: unmatchedAfterAlias,
    },
    unresolvedLines: [...aliasResolvedLines, ...fuzzyLines],
  };
}

// ---------------------------------------------------------------------------
// Alias + AI enrichment (AI fallback path)
// ---------------------------------------------------------------------------

async function enrichWithAliasesAndAiMatching(
  result: SupplierInvoicePdfPrefillResult,
  tenantId: string,
  supplierId: string | null,
  candidateProducts: ProductMatchCandidate[],
): Promise<{ result: SupplierInvoicePdfPrefillResult; unresolvedLines: UnresolvedLine[] }> {
  if (result.unmatchedLineDescriptions.length === 0) {
    return { result, unresolvedLines: [] };
  }

  // supplierId may be null — matchProductsMultiStage handles that:
  // aliases return empty, AI is gated internally on supplierId != null.
  const matchResults = await matchProductsMultiStage({
    tenantId,
    supplierId,
    vendorProductNames: result.unmatchedLineDescriptions,
    candidateProducts,
    useAiFallback: true,
  });

  const matchEntries = new Map<string, LineMatchEntry>();
  for (const m of matchResults) {
    matchEntries.set(m.vendorProductName, {
      productId: m.productId,
      confidence: m.confidence,
      aiSuggestionPending: m.aiSuggestionPending,
    });
  }

  const unresolvedLines: UnresolvedLine[] = matchResults.map(m => ({
    vendorProductName: m.vendorProductName,
    suggestedProductId: m.productId,
    confidence: m.confidence,
    stage: m.stage,
    reasoning: m.reasoning,
    aiSuggestionPending: m.aiSuggestionPending,
    topCandidates: m.topCandidates,
    aiSuggestion: m.aiSuggestion,
  }));

  // Patch lines with newly resolved product IDs (only high-confidence non-AI matches).
  // applyMatchResultsToLines looks up each line's own description, not first-available.
  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(
    result.values.lines,
    result.unmatchedLineDescriptions,
    matchEntries,
  );

  return {
    result: {
      ...result,
      values: { ...result.values, lines: enrichedLines },
      unmatchedLineDescriptions: stillUnmatched.filter(Boolean),
    },
    unresolvedLines,
  };
}

// ---------------------------------------------------------------------------
// Proposed profile
// ---------------------------------------------------------------------------

function buildProposedProfile(
  result: SupplierInvoicePdfPrefillResult,
  supplierRows: Array<{ id: string; name: string }>,
): { supplierId: string; keywords: string[] } | null {
  if (!result.values.supplierId) return null;
  const matchedName = supplierRows.find(s => s.id === result.values.supplierId)?.name;
  const keywords = buildProfileKeywords(matchedName, result.unmatchedSupplierCandidates);
  return { supplierId: result.values.supplierId, keywords };
}

// ---------------------------------------------------------------------------
// Price deviation detection
// ---------------------------------------------------------------------------

async function detectPriceDeviations({
  tenantId,
  supplierId,
  lines,
  productNames,
}: {
  tenantId: string;
  supplierId: string | null;
  lines: Array<{ productId: string; unitPrice: string }>;
  productNames: Map<string, string>;
}): Promise<PriceDeviation[]> {
  if (!supplierId) return [];

  const relevant = lines.filter(l => l.productId && Number(l.unitPrice) > 0);
  if (relevant.length === 0) return [];

  const productIds = [...new Set(relevant.map(l => l.productId))];

  const rows = await db
    .select({
      productId: supplierInvoiceLines.productId,
      unitPrice: supplierInvoiceLines.unitPrice,
      invoiceDate: supplierInvoices.invoiceDate,
    })
    .from(supplierInvoiceLines)
    .innerJoin(supplierInvoices, eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id))
    .where(
      and(
        eq(supplierInvoices.tenantId, tenantId),
        eq(supplierInvoices.supplierId, supplierId),
        inArray(supplierInvoiceLines.productId, productIds),
        ne(supplierInvoices.status, "draft"),
      ),
    )
    .orderBy(desc(supplierInvoices.invoiceDate));

  // Take the most recent invoice line per product (rows already sorted DESC).
  const latestByProduct = new Map<string, { unitPrice: string; invoiceDate: string }>();
  for (const row of rows) {
    if (!latestByProduct.has(row.productId)) {
      latestByProduct.set(row.productId, { unitPrice: row.unitPrice, invoiceDate: row.invoiceDate });
    }
  }

  const deviations: PriceDeviation[] = [];
  for (const { productId, unitPrice: parsedStr } of relevant) {
    const latest = latestByProduct.get(productId);
    if (!latest) continue;

    const parsedPrice = Number(parsedStr);
    const lastPrice = Number(latest.unitPrice);
    if (!parsedPrice || !lastPrice) continue;

    const deviationPct = ((parsedPrice - lastPrice) / lastPrice) * 100;
    if (Math.abs(deviationPct) < PRICE_DEVIATION_THRESHOLD_PCT) continue;

    deviations.push({
      productId,
      productName: productNames.get(productId) ?? productId,
      parsedUnitPrice: parsedPrice,
      lastUnitPrice: lastPrice,
      deviationPct,
      lastInvoiceDate: latest.invoiceDate,
    });
  }

  return deviations;
}

// ---------------------------------------------------------------------------
// Scanned PDF result
// ---------------------------------------------------------------------------

function buildScannedPdfResult(sourceFilename: string): PipelineResult {
  const emptyLine: SupplierInvoicePdfPrefillLine = {
    productId: "",
    unitType: "catch_weight",
    weightEntryMode: "total_weight",
    quantityCases: "1",
    weightLbs: "0",
    defaultCaseWeightLbs: "",
    caseWeightEntries: [""],
    unitPrice: "0",
    lotNumberOverride: "",
    expirationDateOverride: "",
  };

  return {
    prefillResult: {
      values: {
        supplierId: "",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().slice(0, 10),
        receiveDate: new Date().toISOString().slice(0, 10),
        paymentMethod: null,
        notes: "",
        lines: [emptyLine],
      },
      warnings: [
        "This PDF appears to be a scanned image with no readable text. OCR support is not yet available — enter invoice data manually.",
      ],
      unmatchedSupplierCandidates: [],
      unmatchedLineDescriptions: [],
      sourceFilename,
      totalComparison: {
        extractedTotal: null,
        computedLineTotal: "0.00",
        variance: null,
        matches: null,
      },
    },
    confidence: 0,
    confidenceBreakdown: {
      invoiceNumberFound: false,
      invoiceDateFound: false,
      supplierMatched: false,
      linesExtracted: false,
      totalsMatch: null,
      unmatchedProductRatio: 1,
      score: 0,
    },
    source: "deterministic",
    aiUsed: false,
    requiresOcr: true,
    warnings: ["Scanned PDF detected — OCR required."],
    unresolvedLines: [],
    detectedFees: [],
    priceDeviations: [],
    detectedProfileId: null,
    proposedProfile: null,
    visionUsed: false,
  };
}

// ---------------------------------------------------------------------------
// First-bill mode helpers
// ---------------------------------------------------------------------------

function suggestProductName(rawVendorText: string): string {
  // Strip leading product codes like "QH-", "AB123-" (2-6 chars then separator)
  const stripped = rawVendorText.replace(/^[A-Z0-9]{2,6}[-_ ]/i, "").trim();
  return stripped
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildFirstBillResult(
  result: SupplierInvoicePdfPrefillResult,
  source: PipelineParseSource,
  aiUsed: boolean,
  visionUsed: boolean,
): PipelineResult {
  const descriptions = result.unmatchedLineDescriptions;
  const lines = result.values.lines;
  const count = Math.min(descriptions.length, lines.length);

  const firstBillLines: FirstBillLine[] = Array.from({ length: count }, (_, i) => ({
    rawVendorText: descriptions[i] ?? "",
    suggestedName: suggestProductName(descriptions[i] ?? ""),
    quantityCases: lines[i]?.quantityCases ?? "1",
    weightLbs: lines[i]?.weightLbs ?? "0",
    unitPrice: lines[i]?.unitPrice ?? "0",
    unitType: (lines[i]?.unitType ?? "catch_weight") as "catch_weight" | "fixed_case",
  }));

  return {
    prefillResult: result,
    confidence: 0,
    confidenceBreakdown: {
      invoiceNumberFound: !!result.values.invoiceNumber,
      invoiceDateFound: !!result.values.invoiceDate,
      supplierMatched: !!result.values.supplierId,
      linesExtracted: firstBillLines.length > 0,
      totalsMatch: null,
      unmatchedProductRatio: 1,
      score: 0,
    },
    source,
    aiUsed,
    requiresOcr: false,
    warnings: result.warnings,
    unresolvedLines: [],
    detectedFees: [],
    priceDeviations: [],
    detectedProfileId: null,
    proposedProfile: null,
    visionUsed,
    firstBillLines,
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(v.trim());
  }
  return result;
}
