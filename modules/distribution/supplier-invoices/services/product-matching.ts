import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { supplierProductAliases, products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { normalizeProductName, fuzzyScore } from "../utils/normalization";
import {
  extractMeatProductSignals,
  scoreCandidateAgainstSignals,
  selectTopCandidatesForMatching,
} from "../utils/meat-signals";
import { suggestProductMatches as aiSuggestProductMatches } from "./ai-extraction";

// ---------------------------------------------------------------------------
// Alias CRUD
// ---------------------------------------------------------------------------

export type ProductAlias = {
  id: string;
  tenantId: string;
  supplierId: string;
  vendorProductName: string;
  normalizedVendorProductName: string;
  internalProductId: string;
  confidence: number;
  source: "manual" | "ai_suggested" | "confirmed" | "parser";
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAliasInput = {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
  confidence?: number;
  source?: "manual" | "ai_suggested" | "confirmed" | "parser";
};

export type UpdateAliasInput = {
  id: string;
  internalProductId?: string;
  confidence?: number;
  source?: "manual" | "ai_suggested" | "confirmed" | "parser";
};

function rowToAlias(row: typeof supplierProductAliases.$inferSelect): ProductAlias {
  return {
    id: row.id,
    tenantId: row.tenantId,
    supplierId: row.supplierId,
    vendorProductName: row.vendorProductName,
    normalizedVendorProductName: row.normalizedVendorProductName,
    internalProductId: row.internalProductId,
    confidence: Number(row.confidence),
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAliasesForSupplier(supplierId: string): Promise<ProductAlias[]> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "view_supplier_invoice");

  const rows = await db
    .select()
    .from(supplierProductAliases)
    .where(
      and(
        eq(supplierProductAliases.tenantId, tenant.id),
        eq(supplierProductAliases.supplierId, supplierId),
      ),
    );

  return rows.map(rowToAlias);
}

export async function upsertProductAlias(input: CreateAliasInput): Promise<ProductAlias> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const normalized = normalizeProductName(input.vendorProductName);
  if (!normalized) throw new Error("Vendor product name cannot be empty.");

  const [row] = await db
    .insert(supplierProductAliases)
    .values({
      tenantId: tenant.id,
      supplierId: input.supplierId,
      vendorProductName: input.vendorProductName.trim(),
      normalizedVendorProductName: normalized,
      internalProductId: input.internalProductId,
      confidence: String(input.confidence ?? 100),
      source: input.source ?? "manual",
      createdByUserId: currentUser.id,
    })
    .onConflictDoUpdate({
      target: [
        supplierProductAliases.tenantId,
        supplierProductAliases.supplierId,
        supplierProductAliases.normalizedVendorProductName,
      ],
      set: {
        internalProductId: input.internalProductId,
        confidence: String(input.confidence ?? 100),
        source: input.source ?? "manual",
        updatedAt: new Date(),
      },
    })
    .returning();

  return rowToAlias(row);
}

export async function confirmProductAlias(aliasId: string): Promise<ProductAlias> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const [row] = await db
    .update(supplierProductAliases)
    .set({ source: "confirmed", confidence: "100", updatedAt: new Date() })
    .where(
      and(
        eq(supplierProductAliases.id, aliasId),
        eq(supplierProductAliases.tenantId, tenant.id),
      ),
    )
    .returning();

  if (!row) throw new Error("Alias not found.");
  return rowToAlias(row);
}

export async function deleteProductAlias(aliasId: string): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  await db
    .delete(supplierProductAliases)
    .where(
      and(
        eq(supplierProductAliases.id, aliasId),
        eq(supplierProductAliases.tenantId, tenant.id),
      ),
    );
}

// ---------------------------------------------------------------------------
// Multi-stage product matching
// ---------------------------------------------------------------------------

export type MatchStage =
  | "exact_alias"
  | "normalized_alias"
  | "exact_product"
  | "fuzzy_product"
  | "ai_suggested"
  | "unresolved";

export type ProductMatchCandidate = {
  id: string;
  name: string;
  sku: string | null;
  categoryNames?: string[];
  knownAliases?: string[];
};

export type ProductMatchResult = {
  vendorProductName: string;
  productId: string | null;
  confidence: number;
  stage: MatchStage;
  reasoning: string;
  aiSuggestionPending: boolean;
  topCandidates?: Array<{ id: string; name: string; score: number }>;
  aiSuggestion?: { productId: string | null; confidence: number } | null;
};

export async function matchProductsMultiStage(args: {
  tenantId: string;
  supplierId: string | null;
  vendorProductNames: string[];
  candidateProducts: ProductMatchCandidate[];
  useAiFallback?: boolean;
}): Promise<ProductMatchResult[]> {
  const { tenantId, supplierId, vendorProductNames, candidateProducts, useAiFallback } = args;

  // Load aliases for this tenant+supplier
  const aliases =
    supplierId && tenantId
      ? await db
          .select()
          .from(supplierProductAliases)
          .where(
            and(
              eq(supplierProductAliases.tenantId, tenantId),
              eq(supplierProductAliases.supplierId, supplierId),
            ),
          )
      : [];

  const aliasMap = new Map<string, ProductAlias>();
  for (const row of aliases) {
    aliasMap.set(row.normalizedVendorProductName, rowToAlias(row));
  }

  // Build inverted alias map: productId → vendor names (for AI context)
  const productAliasNames = new Map<string, string[]>();
  for (const alias of aliases) {
    const names = productAliasNames.get(alias.internalProductId) ?? [];
    names.push(alias.vendorProductName);
    productAliasNames.set(alias.internalProductId, names);
  }

  // Attach known aliases to candidates for richer AI context
  const enrichedCandidates: ProductMatchCandidate[] = candidateProducts.map(c => ({
    ...c,
    knownAliases: productAliasNames.get(c.id) ?? c.knownAliases,
  }));

  // Stage 1: deterministic matching for all names
  const results: ProductMatchResult[] = [];
  const unresolvedNames: string[] = [];

  for (const vendorName of vendorProductNames) {
    const result = matchProductDeterministic(vendorName, aliasMap, enrichedCandidates);
    results.push(result);
    if (result.stage === "unresolved") {
      unresolvedNames.push(vendorName);
    }
  }

  // Stage 2: AI suggestions for unresolved names
  if (useAiFallback && unresolvedNames.length > 0 && supplierId) {
    // Pre-score candidates using domain signals; send only top N to AI
    const prescored = selectTopCandidatesForMatching(unresolvedNames, enrichedCandidates);
    const aiCandidates = prescored.map(ps => ps.candidate);

    // Build top candidates debug info per vendor name
    const topCandidatesMap = new Map<string, Array<{ id: string; name: string; score: number }>>();
    for (const vendorName of unresolvedNames) {
      const vs = extractMeatProductSignals(vendorName);
      const scored = aiCandidates.map(c => {
        const { score } = scoreCandidateAgainstSignals(vs, extractMeatProductSignals(c.name), c.id);
        return { id: c.id, name: c.name, score };
      });
      scored.sort((a, b) => b.score - a.score);
      topCandidatesMap.set(vendorName, scored.slice(0, 5));
    }

    let aiMatches: Map<string, { suggestedProductId: string | null; confidence: number }> =
      new Map();

    try {
      const aiResult = await aiSuggestProductMatches({
        tenantId,
        supplierId,
        vendorProductNames: unresolvedNames,
        candidateProducts: aiCandidates,
      });

      for (const m of aiResult.matches) {
        if (m.confidence >= 50 && m.suggestedProductId) {
          aiMatches.set(m.vendorProductName, {
            suggestedProductId: m.suggestedProductId,
            confidence: m.confidence,
          });
        }
      }
    } catch {
      // AI failure is non-fatal — keep unresolved.
    }

    for (let i = 0; i < results.length; i++) {
      if (results[i].stage !== "unresolved") continue;
      const name = results[i].vendorProductName;
      const topCandidates = topCandidatesMap.get(name);
      const aiMatch = aiMatches.get(name);

      results[i] = {
        ...results[i],
        topCandidates,
        aiSuggestion: aiMatch
          ? { productId: aiMatch.suggestedProductId, confidence: aiMatch.confidence }
          : null,
        ...(aiMatch?.suggestedProductId
          ? {
              productId: aiMatch.suggestedProductId,
              confidence: aiMatch.confidence,
              stage: "ai_suggested" as MatchStage,
              reasoning: "AI semantic match — requires human confirmation before saving alias.",
              aiSuggestionPending: true,
            }
          : {}),
      };
    }
  }

  return results;
}

function matchProductDeterministic(
  vendorName: string,
  aliasMap: Map<string, ProductAlias>,
  candidates: ProductMatchCandidate[],
): ProductMatchResult {
  const normalized = normalizeProductName(vendorName);

  // Stage 1: exact alias match
  const exactAlias = aliasMap.get(normalized);
  if (exactAlias) {
    return {
      vendorProductName: vendorName,
      productId: exactAlias.internalProductId,
      confidence: exactAlias.confidence,
      stage: "exact_alias",
      reasoning: `Matched saved alias (${exactAlias.source}).`,
      aiSuggestionPending: false,
    };
  }

  // Stage 2: normalized alias match (handles minor normalization differences)
  if (normalized) {
    const normalizedAlias = aliasMap.get(normalized);
    if (normalizedAlias) {
      return {
        vendorProductName: vendorName,
        productId: normalizedAlias.internalProductId,
        confidence: Math.min(normalizedAlias.confidence, 90),
        stage: "normalized_alias",
        reasoning: "Matched normalized alias.",
        aiSuggestionPending: false,
      };
    }
  }

  // Stage 3: exact product name/sku match
  for (const product of candidates) {
    if (
      normalizeProductName(product.name) === normalized ||
      (product.sku && normalizeProductName(product.sku) === normalized)
    ) {
      return {
        vendorProductName: vendorName,
        productId: product.id,
        confidence: 95,
        stage: "exact_product",
        reasoning: "Exact normalized name match against internal catalog.",
        aiSuggestionPending: false,
      };
    }
  }

  // Stage 4: fuzzy match
  let bestScore = 0;
  let bestProduct: ProductMatchCandidate | null = null;
  for (const product of candidates) {
    const score = Math.max(
      fuzzyScore(vendorName, product.name),
      product.sku ? fuzzyScore(vendorName, product.sku) : 0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  if (bestProduct && bestScore >= 60) {
    return {
      vendorProductName: vendorName,
      productId: bestProduct.id,
      confidence: bestScore,
      stage: "fuzzy_product",
      reasoning: `Fuzzy match (score ${bestScore}) — review before confirming.`,
      aiSuggestionPending: false,
    };
  }

  // Stage 5: unresolved
  return {
    vendorProductName: vendorName,
    productId: null,
    confidence: 0,
    stage: "unresolved",
    reasoning: "No match found — manual selection required.",
    aiSuggestionPending: false,
  };
}

// ---------------------------------------------------------------------------
// Internal helper used by parsing pipeline (no auth — pipeline is server-side)
// ---------------------------------------------------------------------------

export async function resolveAliasesForTenant(args: {
  tenantId: string;
  supplierId: string;
}): Promise<Map<string, string>> {
  const rows = await db
    .select({
      normalizedVendorProductName: supplierProductAliases.normalizedVendorProductName,
      internalProductId: supplierProductAliases.internalProductId,
    })
    .from(supplierProductAliases)
    .where(
      and(
        eq(supplierProductAliases.tenantId, args.tenantId),
        eq(supplierProductAliases.supplierId, args.supplierId),
      ),
    );

  return new Map(rows.map(r => [r.normalizedVendorProductName, r.internalProductId]));
}

// ---------------------------------------------------------------------------
// Save an AI-suggested alias after user confirms it.
// ---------------------------------------------------------------------------

export async function saveConfirmedAiAlias(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}): Promise<ProductAlias> {
  return upsertProductAlias({
    supplierId: args.supplierId,
    vendorProductName: args.vendorProductName,
    internalProductId: args.internalProductId,
    confidence: 100,
    source: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// Save a manual product selection as an alias immediately.
// ---------------------------------------------------------------------------

export async function recordManualProductSelection(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}): Promise<ProductAlias> {
  return upsertProductAlias({
    supplierId: args.supplierId,
    vendorProductName: args.vendorProductName,
    internalProductId: args.internalProductId,
    confidence: 100,
    source: "manual",
  });
}

// ---------------------------------------------------------------------------
// Fetch all aliases for tenant (admin view)
// ---------------------------------------------------------------------------

export async function getAllAliasesForTenant(): Promise<ProductAlias[]> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "view_supplier_invoice");

  const rows = await db
    .select()
    .from(supplierProductAliases)
    .where(eq(supplierProductAliases.tenantId, tenant.id));

  return rows.map(rowToAlias);
}
