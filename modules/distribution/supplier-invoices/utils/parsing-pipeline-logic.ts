// Pure helpers for line-patching logic in the parsing pipeline.
// No server-only import — safe to use in tests and shared utilities.

import type { AiExtractionErrorCode } from "../services/ai-provider";
import type { SupplierInvoicePdfPrefillLine } from "./pdf-prefill";
import { normalizeProductName } from "./normalization";

export type PipelineParseStatus = "success" | "partial_success" | "parse_error";

/**
 * Compute the pipeline's `parseStatus` from the per-stage AI outcomes plus
 * the deterministic line count. Pure — extracted from `runParsingPipeline`
 * so the rules can be unit-tested without spinning up the full pipeline.
 *
 * Rules:
 *  - `parse_error` when AI failed AND (vision failed or wasn't attempted)
 *    AND vision wasn't usefully applied AND deterministic produced fewer
 *    than 2 real lines.
 *  - `partial_success` when at least one AI stage failed but the pipeline
 *    still produced a defensible result by other means.
 *  - `success` otherwise.
 */
export function computePipelineParseStatus(args: {
  aiStatus: "success" | "failed";
  visionAttempted: boolean;
  visionStatus: "success" | "failed" | null;
  visionUsefullyApplied: boolean;
  realDeterministicLineCount: number;
}): PipelineParseStatus {
  const aiFailed = args.aiStatus === "failed";
  const visionFailed =
    args.visionAttempted && args.visionStatus === "failed";

  if (
    aiFailed &&
    (visionFailed || !args.visionAttempted) &&
    !args.visionUsefullyApplied &&
    args.realDeterministicLineCount < 2
  ) {
    return "parse_error";
  }
  if (aiFailed || visionFailed) {
    return "partial_success";
  }
  return "success";
}

/**
 * Collect every non-null `errorCode` from the AI stages that ran during a
 * single pipeline invocation. Pure helper used alongside
 * `computePipelineParseStatus`.
 */
export function collectPipelineErrorCodes(args: {
  aiErrorCode: AiExtractionErrorCode | null;
  visionAttempted: boolean;
  visionErrorCode: AiExtractionErrorCode | null;
}): AiExtractionErrorCode[] {
  const codes: AiExtractionErrorCode[] = [];
  if (args.aiErrorCode) codes.push(args.aiErrorCode);
  if (args.visionAttempted && args.visionErrorCode) codes.push(args.visionErrorCode);
  return codes;
}

export type LineMatchEntry = {
  productId: string | null;
  confidence: number;
  aiSuggestionPending: boolean;
};

// C-1 fix: assign alias map entries to form lines by sequential index order.
// Each unmatched line (productId="") consumes the next description from
// unmatchedDescs in order, so line[i] always receives unmatchedDescs[i].
export function applyAliasesToLines(
  lines: SupplierInvoicePdfPrefillLine[],
  unmatchedDescs: string[],
  // Each entry carries the resolved productId, the alias's confirmation
  // count, and an optional persisted unit-type correction (#223). Lines
  // pick up the productId + unit type here; the count is propagated to
  // UnresolvedLine elsewhere so the Review screen can render a trust chip.
  aliasMap: ReadonlyMap<
    string,
    {
      internalProductId: string;
      confirmationCount: number;
      preferredUnitType?: "catch_weight" | "fixed_case" | null;
    }
  >,
): SupplierInvoicePdfPrefillLine[] {
  let unmatchedIdx = 0;
  return lines.map(line => {
    if (line.productId) return line;
    const desc = unmatchedDescs[unmatchedIdx++] ?? "";
    const normalized = normalizeProductName(desc);
    const aliasEntry = normalized ? aliasMap.get(normalized) : undefined;
    if (!aliasEntry) return line;
    // Apply the persisted unit-type correction whenever the alias carries
    // one — the user explicitly corrected this on a prior bill, so the
    // saved preference beats whatever the AI/text path guessed this
    // time. If the persisted preference happens to match the parser's
    // current guess, the assignment is a no-op.
    const preferred = aliasEntry.preferredUnitType;
    const overrideUnit =
      preferred === "catch_weight" || preferred === "fixed_case";
    return {
      ...line,
      productId: aliasEntry.internalProductId,
      ...(overrideUnit ? { unitType: preferred } : {}),
    };
  });
}

// C-2 fix: assign match results to form lines by looking up each line's own
// vendor description in matchByName. Tracks resolved lines by index so that
// duplicate descriptions are handled correctly and stillUnmatched stays aligned.
export function applyMatchResultsToLines(
  lines: SupplierInvoicePdfPrefillLine[],
  unmatchedDescs: string[],
  matchByName: ReadonlyMap<string, LineMatchEntry>,
): { enrichedLines: SupplierInvoicePdfPrefillLine[]; stillUnmatched: string[] } {
  let unmatchedIdx = 0;
  const resolvedIndices = new Set<number>();

  const enrichedLines = lines.map(line => {
    if (line.productId) return line;
    const idx = unmatchedIdx++;
    const desc = unmatchedDescs[idx] ?? "";
    const match = matchByName.get(desc);
    if (match?.productId && match.confidence >= 60) {
      resolvedIndices.add(idx);
      return { ...line, productId: match.productId };
    }
    return line;
  });

  const stillUnmatched = unmatchedDescs.filter((_, i) => !resolvedIndices.has(i));
  return { enrichedLines, stillUnmatched };
}

// ---------------------------------------------------------------------------
// Alias intent — pure description of whether a row action should save an alias
// and with what parameters. Used by UnresolvedRow (accept/choose/ignore) and
// tested independently of the server mutation.
// ---------------------------------------------------------------------------

export type AliasParams =
  | {
      save: true;
      supplierId: string;
      vendorProductName: string;
      internalProductId: string;
      source: "confirmed" | "manual";
    }
  | { save: false };

export function resolveAliasParams(
  action: "accept" | "choose" | "ignore",
  supplierId: string | null,
  vendorProductName: string,
  suggestedProductId: string | null,
  chosenProductId: string,
): AliasParams {
  if (action === "ignore" || !supplierId) return { save: false };
  if (action === "accept" && suggestedProductId) {
    return {
      save: true,
      supplierId,
      vendorProductName,
      internalProductId: suggestedProductId,
      source: "confirmed",
    };
  }
  if (action === "choose" && chosenProductId) {
    return {
      save: true,
      supplierId,
      vendorProductName,
      internalProductId: chosenProductId,
      source: "manual",
    };
  }
  return { save: false };
}

// ---------------------------------------------------------------------------
// Submit safety — count of rows that still need user action (neither resolved
// by alias save nor dismissed via ignore).
// ---------------------------------------------------------------------------

export function countBlockingUnresolved(
  actionableCount: number,
  resolvedCount: number,
  ignoredCount: number,
): number {
  return Math.max(0, actionableCount - resolvedCount - ignoredCount);
}

// ---------------------------------------------------------------------------
// Product search filtering — pure, testable, used by combobox in review panel
// ---------------------------------------------------------------------------

// Filter a product list by name or SKU, case-insensitive substring match.
// Generic so it preserves the full type (ProductListItem, topCandidate, etc.).
export function filterProducts<T extends { id: string; name: string; sku?: string | null }>(
  products: ReadonlyArray<T>,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return products as T[];
  return products.filter(
    p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku != null && p.sku.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Profile keyword generation — pure, testable, no server-only dependency
// ---------------------------------------------------------------------------

// Build detection keywords for an import profile.
// Priority: matched supplier name tokens first, then unmatched supplier candidate
// text as supplementary. Avoids invoice-specific tokens by working at word level.
export function buildProfileKeywords(
  matchedSupplierName: string | undefined,
  unmatchedCandidates: string[],
): string[] {
  const nameTokens = matchedSupplierName
    ? matchedSupplierName.toUpperCase().split(/\s+/).filter(w => w.length >= 4)
    : [];

  const candidateTokens = unmatchedCandidates
    .flatMap(c => c.toUpperCase().split(/\s+/))
    .filter(w => w.length >= 4);

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of [...nameTokens, ...candidateTokens]) {
    if (!seen.has(token)) {
      seen.add(token);
      keywords.push(token);
    }
    if (keywords.length === 5) break;
  }
  return keywords;
}
