import "server-only";

import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/db";
import { products, suppliers, productCategories, categories } from "@/db/schema";
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
  type ProductMatchResult,
} from "./product-matching";

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
  detectedProfileId: string | null;
  proposedProfile: {
    supplierId: string;
    keywords: string[];
  } | null;
  visionUsed: boolean;
  debug?: PipelineDebugInfo;
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
}): Promise<PipelineResult> {
  const {
    extractedText,
    sourceFilename,
    tenantId,
    pdfPageCount = 1,
    aiConfidenceThreshold = 60,
    pdfBytes,
    debug = false,
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

  // If deterministic confidence is sufficient AND it actually extracted lines, skip AI/vision.
  // Require linesExtracted so that invoices where the header parsed but no product rows were
  // matched (score=60 but linesExtracted=false) still fall through to AI/vision.
  if (breakdown.score >= threshold && breakdown.linesExtracted) {
    const enriched = await enrichWithAliases(deterministicResult, tenantId, supplierId);
    return {
      prefillResult: enriched.result,
      confidence: breakdown.score,
      confidenceBreakdown: breakdown,
      source: "deterministic",
      aiUsed: false,
      requiresOcr: false,
      warnings: deterministicResult.warnings,
      unresolvedLines: enriched.unresolvedLines,
      detectedFees: [],
      detectedProfileId: detectedProfile?.id ?? null,
      proposedProfile: buildProposedProfile(deterministicResult, extractedText),
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

  const mergedResult = mergeAiOverDeterministic(deterministicResult, aiResult, supplierRows);
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
      finalResult = mergeVisionOverResult(mergedResult, visionResult, supplierRows);
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

  const enriched = await enrichWithAliasesAndAiMatching(
    finalResult,
    tenantId,
    finalResult.values.supplierId || null,
    richProductRows,
  );

  // Warn when AI text parsed line totals but lost the weight column, and vision either
  // wasn't attempted or returned 0 lines — the form will show $0.00 until user fills weights.
  const aiHasNullWeights =
    aiResult.lines.length > 0 &&
    aiResult.lines.every(l => l.quantityWeight === null);
  const visionFailed = needsVision && (visionResult === null || visionResult.lines.length === 0);
  const nullWeightWarning =
    aiHasNullWeights && mergedBreakdown.totalsMatch === false && visionFailed
      ? "Weight column could not be recovered from this PDF — all line weights are 0. Enter weights manually before saving."
      : null;

  const allWarnings = [
    ...finalResult.warnings,
    ...(visionUsed ? [] : aiResult.warnings),
    ...(nullWeightWarning ? [nullWeightWarning] : []),
    "AI extraction was used — review all fields before saving.",
  ];

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
    prefillResult: enriched.result,
    confidence: finalBreakdown.score,
    confidenceBreakdown: finalBreakdown,
    source,
    aiUsed: true,
    requiresOcr: false,
    warnings: dedupeStrings(allWarnings),
    unresolvedLines: enriched.unresolvedLines,
    detectedFees: visionUsed
      ? (visionResult?.fees ?? [])
      : aiResult.fees,
    detectedProfileId: detectedProfile?.id ?? null,
    proposedProfile:
      (visionResult?.confidence ?? aiResult.confidence) >= 70
        ? buildProposedProfile(finalResult, extractedText)
        : null,
    visionUsed,
    debug: debugInfo,
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
// Merge vision result over existing merged result
// ---------------------------------------------------------------------------

function mergeVisionOverResult(
  current: SupplierInvoicePdfPrefillResult,
  vision: VisionExtractionResult,
  supplierRows: Array<{ id: string; name: string }>,
): SupplierInvoicePdfPrefillResult {
  // Build lines from vision extraction
  const lines = vision.lines.map(vl => ({
    productId: "",
    unitType: vl.unitType ?? "catch_weight",
    weightEntryMode: "total_weight" as const,
    quantityCases: String(vl.quantityCases ?? 1),
    weightLbs: String(vl.quantityWeight ?? 0),
    defaultCaseWeightLbs: "",
    caseWeightEntries: Array.from(
      { length: Math.max(1, vl.quantityCases ?? 1) },
      () => "",
    ),
    unitPrice: String(vl.unitPrice ?? 0),
    lotNumberOverride: "",
    expirationDateOverride: "",
  }));

  const unmatchedLineDescriptions = vision.lines.map(l => l.vendorProductName);

  // Resolve supplier from vision if not already matched
  let supplierId = current.values.supplierId;
  if (!supplierId && vision.supplierName) {
    const normalized = vision.supplierName.toUpperCase();
    const match = supplierRows.find(s => s.name.toUpperCase() === normalized);
    if (match) supplierId = match.id;
  }

  const invoiceNumber = current.values.invoiceNumber || vision.invoiceNumber || "";
  const invoiceDate =
    current.values.invoiceDate || vision.invoiceDate || new Date().toISOString().slice(0, 10);

  // Recompute totalComparison from vision line totals so scoreParseResult sees current data.
  const computedSum = vision.lines.reduce((s, l) => {
    if (l.lineTotal != null) return s + l.lineTotal;
    const price = l.unitPrice ?? 0;
    if (l.unitType === "catch_weight") return s + (l.quantityWeight ?? 0) * price;
    return s + (l.quantityCases ?? 1) * price;
  }, 0);
  const visionTotal = vision.totalAmount;
  const varianceVision =
    visionTotal != null && computedSum > 0
      ? Math.abs(visionTotal - computedSum) / visionTotal
      : null;
  const updatedTotalComparison = {
    extractedTotal: visionTotal != null ? String(visionTotal) : current.totalComparison.extractedTotal,
    computedLineTotal: computedSum.toFixed(2),
    variance: varianceVision != null ? varianceVision.toFixed(4) : null,
    matches: varianceVision != null ? varianceVision <= 0.02 : null,
  };

  const warnings = dedupeStrings([
    ...current.warnings,
    ...vision.warnings,
    `Vision-based table extraction used — ${vision.lines.length} row(s) extracted visually.`,
  ]);

  if (vision.fees.length > 0) {
    warnings.push(
      `Non-inventory fees detected by vision AI: ${vision.fees.map(f => f.description).join(", ")}.`,
    );
  }

  return {
    ...current,
    values: {
      ...current.values,
      supplierId,
      invoiceNumber,
      invoiceDate,
      receiveDate: invoiceDate,
      lines,
    },
    totalComparison: updatedTotalComparison,
    warnings,
    unmatchedLineDescriptions,
  };
}

// ---------------------------------------------------------------------------
// Alias enrichment (deterministic path — fast, no AI)
// ---------------------------------------------------------------------------

async function enrichWithAliases(
  result: SupplierInvoicePdfPrefillResult,
  tenantId: string,
  supplierId: string | null,
): Promise<{ result: SupplierInvoicePdfPrefillResult; unresolvedLines: UnresolvedLine[] }> {
  if (!supplierId) {
    return {
      result,
      unresolvedLines: result.unmatchedLineDescriptions.map(name => ({
        vendorProductName: name,
        suggestedProductId: null,
        confidence: 0,
        stage: "unresolved",
        reasoning: "Supplier not matched — cannot look up aliases.",
        aiSuggestionPending: false,
      })),
    };
  }

  const aliasMap = await resolveAliasesForTenant({ tenantId, supplierId });

  const enrichedLines = result.values.lines.map(line => {
    if (line.productId) return line;
    const normalized = normalizeProductName(
      result.unmatchedLineDescriptions.find(d => !line.productId) ?? "",
    );
    const aliasProductId = normalized ? aliasMap.get(normalized) : undefined;
    if (aliasProductId) {
      return { ...line, productId: aliasProductId };
    }
    return line;
  });

  const unmatchedDescriptions = result.unmatchedLineDescriptions.filter(desc => {
    const norm = normalizeProductName(desc);
    return !aliasMap.has(norm);
  });

  return {
    result: {
      ...result,
      values: { ...result.values, lines: enrichedLines },
      unmatchedLineDescriptions: unmatchedDescriptions,
    },
    unresolvedLines: result.unmatchedLineDescriptions.map(name => {
      const norm = normalizeProductName(name);
      const matched = aliasMap.has(norm);
      return {
        vendorProductName: name,
        suggestedProductId: matched ? (aliasMap.get(norm) ?? null) : null,
        confidence: matched ? 95 : 0,
        stage: matched ? "normalized_alias" : "unresolved",
        reasoning: matched ? "Matched via saved alias." : "No alias or product match found.",
        aiSuggestionPending: false,
      };
    }),
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
  if (!supplierId || result.unmatchedLineDescriptions.length === 0) {
    return {
      result,
      unresolvedLines: result.unmatchedLineDescriptions.map(name => ({
        vendorProductName: name,
        suggestedProductId: null,
        confidence: 0,
        stage: "unresolved",
        reasoning: "No supplier match — cannot resolve aliases.",
        aiSuggestionPending: false,
      })),
    };
  }

  const matchResults = await matchProductsMultiStage({
    tenantId,
    supplierId,
    vendorProductNames: result.unmatchedLineDescriptions,
    candidateProducts,
    useAiFallback: true,
  });

  const matchByName = new Map<string, ProductMatchResult>();
  for (const m of matchResults) {
    matchByName.set(m.vendorProductName, m);
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

  // Patch lines with newly resolved product IDs (only high-confidence non-AI matches)
  const enrichedLines = result.values.lines.map(line => {
    if (line.productId) return line;
    for (const [name, match] of matchByName) {
      if (match.productId && match.confidence >= 60 && !match.aiSuggestionPending) {
        matchByName.delete(name);
        return { ...line, productId: match.productId };
      }
    }
    return line;
  });

  const stillUnmatched = enrichedLines
    .filter(l => !l.productId)
    .map((_, i) => result.unmatchedLineDescriptions[i] ?? "");

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
// Merge AI result over deterministic result
// ---------------------------------------------------------------------------

function mergeAiOverDeterministic(
  det: SupplierInvoicePdfPrefillResult,
  ai: Awaited<ReturnType<typeof extractSupplierInvoiceWithAi>>,
  supplierRows: Array<{ id: string; name: string }>,
): SupplierInvoicePdfPrefillResult {
  let supplierId = det.values.supplierId;
  if (!supplierId && ai.supplierName) {
    const normalized = ai.supplierName.toUpperCase();
    const match = supplierRows.find(s => s.name.toUpperCase() === normalized);
    if (match) supplierId = match.id;
  }

  const invoiceNumber = det.values.invoiceNumber || ai.invoiceNumber || "";
  const invoiceDate =
    det.values.invoiceDate || ai.invoiceDate || new Date().toISOString().slice(0, 10);

  let lines = det.values.lines;
  let unmatchedLineDescriptions = det.unmatchedLineDescriptions;
  let updatedTotalComparison = det.totalComparison;

  // Replace det lines with AI lines when:
  //  (a) det found nothing real (no descriptions + no priced/weighted lines), OR
  //  (b) AI found more lines than det AND det totals don't reconcile — the det parser
  //      likely captured noise rows (e.g. a stray number matched as a unit price)
  //      rather than the real table, while AI read the column structure correctly.
  const detHasRealLines =
    det.unmatchedLineDescriptions.length > 0 ||
    det.values.lines.some(
      l => Number(l.unitPrice) > 0 || (l.weightLbs && Number(l.weightLbs) > 0),
    );
  const aiHasMoreLines = ai.lines.length > det.values.lines.length;
  const detTotalsOk = det.totalComparison.matches === true;

  if ((!detHasRealLines || (aiHasMoreLines && !detTotalsOk)) && ai.lines.length > 0) {
    lines = ai.lines.map(aiLine => ({
      productId: "",
      unitType: aiLine.unitType ?? "catch_weight",
      weightEntryMode: "total_weight" as const,
      quantityCases: String(aiLine.quantityCases ?? 1),
      weightLbs: String(aiLine.quantityWeight ?? 0),
      defaultCaseWeightLbs: "",
      caseWeightEntries: Array.from(
        { length: Math.max(1, aiLine.quantityCases ?? 1) },
        () => "",
      ),
      unitPrice: String(aiLine.unitPrice ?? 0),
      lotNumberOverride: "",
      expirationDateOverride: "",
    }));
    unmatchedLineDescriptions = ai.lines.map(l => l.vendorProductName);

    // Recompute totalComparison so scoreParseResult sees current line totals, not stale det values.
    const computedSum = ai.lines.reduce((s, l) => {
      if (l.lineTotal != null) return s + l.lineTotal;
      const price = l.unitPrice ?? 0;
      if (l.unitType === "catch_weight") return s + (l.quantityWeight ?? 0) * price;
      return s + (l.quantityCases ?? 1) * price;
    }, 0);
    const aiTotal = ai.totalAmount;
    const variance =
      aiTotal != null && computedSum > 0
        ? Math.abs(aiTotal - computedSum) / aiTotal
        : null;
    updatedTotalComparison = {
      extractedTotal: aiTotal != null ? String(aiTotal) : det.totalComparison.extractedTotal,
      computedLineTotal: computedSum.toFixed(2),
      variance: variance != null ? variance.toFixed(4) : null,
      matches: variance != null ? variance <= 0.02 : null,
    };
  }

  const warnings = [...det.warnings];
  if (ai.warnings.length > 0) warnings.push(...ai.warnings);
  if (ai.fees.length > 0) {
    warnings.push(
      `Non-inventory fees detected by AI: ${ai.fees.map(f => f.description).join(", ")}.`,
    );
  }

  return {
    ...det,
    values: {
      ...det.values,
      supplierId,
      invoiceNumber,
      invoiceDate,
      receiveDate: invoiceDate,
      lines,
    },
    totalComparison: updatedTotalComparison,
    warnings: dedupeStrings(warnings),
    unmatchedLineDescriptions,
  };
}

// ---------------------------------------------------------------------------
// Proposed profile
// ---------------------------------------------------------------------------

function buildProposedProfile(
  result: SupplierInvoicePdfPrefillResult,
  _extractedText: string,
): { supplierId: string; keywords: string[] } | null {
  if (!result.values.supplierId) return null;
  const keywords = result.unmatchedSupplierCandidates
    .flatMap(c => c.toUpperCase().split(/\s+/))
    .filter(w => w.length >= 4)
    .slice(0, 5);
  return { supplierId: result.values.supplierId, keywords };
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
    detectedProfileId: null,
    proposedProfile: null,
    visionUsed: false,
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
