"use server";

import { z } from "zod";

import { requireFeature } from "@/modules/core/feature-flags";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { searchCustomers } from "@/modules/distribution/customers/services/customers";
import { getProducts } from "@/modules/distribution/products/services/products";

import { AI_ASSISTED_ENTRY_FEATURE } from "../feature";
import { extractSalesOrderFromText } from "../services/ai-order-extraction";
import type { AiOrderExtractionErrorCode } from "../services/ai-order-extraction";
import { matchCustomerByName } from "../services/customer-matching";

import type { ParseSalesOrderTextResult } from "./parse-order-text.types";

// ---------------------------------------------------------------------------
// Input schema — 20K-char ceiling matches the AI extractor's truncation
// budget. Anything bigger is almost certainly a forwarded thread or a copy-
// pasted catalog; we trim at the extraction layer too but a Zod ceiling here
// gives a cleaner client error than a silent backend truncation.
// ---------------------------------------------------------------------------

const parseSalesOrderTextInputSchema = z.object({
  rawText: z
    .string()
    .min(1, "Paste a customer message to parse.")
    .max(20_000, "Message is too long (20K chars max)."),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyResult(args: {
  errorCode: AiOrderExtractionErrorCode;
  errorMessage: string;
}): ParseSalesOrderTextResult {
  return {
    status: "failed",
    customer: { suggestedId: null, candidates: [], hint: null, confidence: 0 },
    requestedDate: null,
    customerNotes: null,
    internalNotes: null,
    lines: [],
    confidence: 0,
    warnings: [`AI parse failed: ${args.errorMessage}`],
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Parse a pasted customer message into structured order data. Read-only at
 * the DB level — does NOT create or modify any rows. Caller (the New Order
 * form) maps the result into `NewOrderFormValues` and lets the user review
 * before submitting through the existing `createSalesOrderAction`.
 *
 * Gated by `AI_ASSISTED_ENTRY_FEATURE` — `requireFeature` calls `notFound()`
 * when disabled, so the action surfaces as a 404 rather than leaking the
 * "feature exists but is off" signal to tenants without the flag.
 */
export async function parseSalesOrderTextAction(
  input: z.infer<typeof parseSalesOrderTextInputSchema>,
): Promise<ParseSalesOrderTextResult> {
  const parsed = parseSalesOrderTextInputSchema.safeParse(input);
  if (!parsed.success) {
    return emptyResult({
      errorCode: "post_validation",
      errorMessage: parsed.error.issues[0]?.message ?? "Invalid input.",
    });
  }

  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, AI_ASSISTED_ENTRY_FEATURE);

  // Fetch tenant-scoped candidate lists. Both calls hit the DB but are
  // already used by the New Order page's prefetch path, so the data is
  // typically warm in any shared cache layer.
  //
  // searchCustomers("") returns the most recent active customers up to
  // its default cap — good enough as candidates for short order messages.
  // For a tenant with thousands of customers, the candidate list will
  // still help the AI prefer known names; when this surface scales,
  // the next iteration swaps the deterministic matcher for pgvector
  // (#244) and stops over-fetching here.
  const [customers, products] = await Promise.all([
    searchCustomers("", 50),
    getProducts(),
  ]);

  const candidateCustomers = customers.map(c => ({ id: c.id, name: c.name }));
  const candidateProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
  }));

  const extracted = await extractSalesOrderFromText({
    rawText: parsed.data.rawText,
    today: todayIso(),
    candidateCustomers,
    candidateProducts,
  });

  if (extracted.status === "failed") {
    return emptyResult({
      errorCode: extracted.errorCode ?? "unknown",
      errorMessage: extracted.errorMessage ?? "AI parse failed.",
    });
  }

  const customerMatch = matchCustomerByName(
    extracted.customerHint,
    candidateCustomers,
  );

  return {
    status: "success",
    customer: {
      suggestedId: customerMatch.suggestedCustomerId,
      candidates: customerMatch.candidates,
      hint: extracted.customerHint,
      confidence: customerMatch.confidence,
    },
    requestedDate: extracted.requestedDate,
    customerNotes: extracted.customerNotes,
    internalNotes: extracted.internalNotes,
    lines: extracted.lines.map(line => ({
      productHint: line.productHint,
      // Validator guarantees positive qty on every retained line; the
      // non-null assertion is safe because phantom lines were dropped.
      qty: line.qty as number,
      unit: line.unit,
      weightLbs: line.weightLbs,
      priceHint: line.priceHint,
      notes: line.notes,
      confidence: line.confidence,
    })),
    confidence: extracted.confidence,
    warnings: extracted.warnings,
    errorCode: null,
    errorMessage: null,
  };
}
