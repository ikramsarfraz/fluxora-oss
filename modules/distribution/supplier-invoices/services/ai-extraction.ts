import "server-only";

import {
  createAiProvider,
  type AiExtractionInput,
  type AiExtractionResult,
  type AiProductMatchInput,
  type AiProductMatchResult,
} from "./ai-provider";
import {
  truncateInvoiceText,
  limitProductCandidates,
  DEFAULT_MAX_INVOICE_TEXT_CHARS,
  DEFAULT_MAX_PRODUCT_CANDIDATES,
} from "../utils/ai-validation";

// Re-export prompts so consumers can reference them without pulling in the
// utils/ai-prompts module directly (backward-compat for any future callers).
export {
  INVOICE_EXTRACTION_SYSTEM_PROMPT,
  PRODUCT_MATCH_SYSTEM_PROMPT,
} from "../utils/ai-prompts";

// ---------------------------------------------------------------------------
// Public API — the pipeline calls these; they never mutate DB state.
// ---------------------------------------------------------------------------

export async function extractSupplierInvoiceWithAi(
  input: AiExtractionInput,
): Promise<AiExtractionResult> {
  const provider = createAiProvider();

  if (!provider.isAvailable()) {
    return {
      supplierName: null,
      supplierInvoiceNumber: null,
      invoiceDate: null,
      totalAmount: null,
      subtotal: null,
      fees: [],
      lines: [],
      confidence: 0,
      warnings: [
        "AI extraction provider is not configured. " +
          "Set AI_PROVIDER=openai and OPENAI_API_KEY to enable.",
      ],
      reasoning: "No AI provider available.",
      status: "failed",
      errorCode: "no_output",
      errorMessage: "AI provider not configured.",
      usage: null,
    };
  }

  // Apply cost controls before handing off to the provider.
  // The OpenAI provider applies them again internally, but doing it here
  // means future providers benefit automatically.
  const guardedInput: AiExtractionInput = {
    ...input,
    extractedText: truncateInvoiceText(input.extractedText, DEFAULT_MAX_INVOICE_TEXT_CHARS),
    candidateProducts: limitProductCandidates(
      input.candidateProducts,
      DEFAULT_MAX_PRODUCT_CANDIDATES,
    ),
  };

  return provider.extractSupplierInvoice(guardedInput);
}

export async function suggestProductMatches(
  input: AiProductMatchInput,
): Promise<AiProductMatchResult> {
  const provider = createAiProvider();

  if (!provider.isAvailable() || input.vendorProductNames.length === 0) {
    // "No names provided" is success-with-empty (legitimately nothing to match).
    // "Provider not configured" is failure (caller should treat as no-op, not
    // as "the model decided there are no matches").
    const failed = !provider.isAvailable();
    return {
      matches: input.vendorProductNames.map(name => ({
        vendorProductName: name,
        suggestedProductId: null,
        confidence: 0,
        reasoning: failed
          ? "AI provider not configured."
          : "No vendor names to match.",
      })),
      status: failed ? "failed" : "success",
      errorCode: failed ? "no_output" : null,
      errorMessage: failed ? "AI provider not configured." : null,
      usage: null,
    };
  }

  const guardedInput: AiProductMatchInput = {
    ...input,
    candidateProducts: limitProductCandidates(
      input.candidateProducts,
      DEFAULT_MAX_PRODUCT_CANDIDATES,
    ),
  };

  return provider.suggestProductMatches(guardedInput);
}
