import "server-only";

import OpenAI from "openai";

import { INVOICE_EXTRACTION_SYSTEM_PROMPT, PRODUCT_MATCH_SYSTEM_PROMPT } from "../utils/ai-prompts";
import {
  truncateInvoiceText,
  limitProductCandidates,
  validateExtractionResult,
  validateProductMatchResult,
  safeParseJson,
  buildInvoiceExtractionUserMessage,
  buildProductMatchUserMessage,
  type ValidatedExtractionResult,
} from "../utils/ai-validation";
import type {
  AiProvider,
  AiExtractionInput,
  AiExtractionResult,
  AiProductMatchInput,
  AiProductMatchResult,
} from "./ai-provider";

// ---------------------------------------------------------------------------
// Token usage — surfaced in warnings for cost visibility
// ---------------------------------------------------------------------------

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

function formatTokenUsage(usage: TokenUsage): string {
  return `OpenAI tokens used: ${usage.totalTokens} (prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`;
}

// ---------------------------------------------------------------------------
// Safe failure builders
// ---------------------------------------------------------------------------

function buildFailureExtractionResult(reason: string): AiExtractionResult {
  return {
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
    fees: [],
    lines: [],
    confidence: 0,
    warnings: [`AI extraction failed: ${reason}`],
    reasoning: reason,
  };
}

function buildFailureMatchResult(
  vendorProductNames: string[],
  reason: string,
): AiProductMatchResult {
  return {
    matches: vendorProductNames.map(name => ({
      vendorProductName: name,
      suggestedProductId: null,
      confidence: 0,
      reasoning: `AI matching failed: ${reason}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly invoiceModel: string;
  private readonly productMatchModel: string;
  private readonly maxInvoiceTextChars: number;
  private readonly maxProductCandidates: number;

  constructor(args: {
    apiKey: string;
    invoiceModel: string;
    productMatchModel: string;
    maxInvoiceTextChars: number;
    maxProductCandidates: number;
  }) {
    this.client = new OpenAI({ apiKey: args.apiKey });
    this.invoiceModel = args.invoiceModel;
    this.productMatchModel = args.productMatchModel;
    this.maxInvoiceTextChars = args.maxInvoiceTextChars;
    this.maxProductCandidates = args.maxProductCandidates;
  }

  isAvailable(): boolean {
    return true;
  }

  async extractSupplierInvoice(input: AiExtractionInput): Promise<AiExtractionResult> {
    const truncatedText = truncateInvoiceText(input.extractedText, this.maxInvoiceTextChars);
    const limitedProducts = limitProductCandidates(
      input.candidateProducts,
      this.maxProductCandidates,
    );

    const userMessage = buildInvoiceExtractionUserMessage({
      filename: input.filename,
      extractedText: truncatedText,
      supplierHints: input.supplierHints,
      candidateSuppliers: input.candidateSuppliers,
      candidateProducts: limitedProducts,
    });

    let rawContent: string;
    let tokenUsage: TokenUsage | undefined;

    try {
      const response = await this.client.chat.completions.create({
        model: this.invoiceModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INVOICE_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      });

      rawContent = response.choices[0]?.message?.content ?? "";
      if (response.usage) {
        tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return buildFailureExtractionResult(`OpenAI API error: ${message}`);
    }

    const parsed = safeParseJson(rawContent);
    if (parsed === null) {
      return buildFailureExtractionResult("OpenAI returned a non-JSON response.");
    }

    const validated = validateExtractionResult(parsed);
    if (!validated) {
      return buildFailureExtractionResult("OpenAI response did not match the expected schema.");
    }

    // Append token usage to warnings for cost visibility.
    const result: AiExtractionResult = {
      ...validated,
      warnings: tokenUsage
        ? [...validated.warnings, formatTokenUsage(tokenUsage)]
        : validated.warnings,
    };

    return result;
  }

  async suggestProductMatches(input: AiProductMatchInput): Promise<AiProductMatchResult> {
    if (input.vendorProductNames.length === 0) {
      return { matches: [] };
    }

    const limitedProducts = limitProductCandidates(
      input.candidateProducts,
      this.maxProductCandidates,
    );

    const userMessage = buildProductMatchUserMessage({
      vendorProductNames: input.vendorProductNames,
      candidateProducts: limitedProducts,
    });

    let rawContent: string;

    try {
      const response = await this.client.chat.completions.create({
        model: this.productMatchModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PRODUCT_MATCH_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      });

      rawContent = response.choices[0]?.message?.content ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return buildFailureMatchResult(
        input.vendorProductNames,
        `OpenAI API error: ${message}`,
      );
    }

    const parsed = safeParseJson(rawContent);
    if (parsed === null) {
      return buildFailureMatchResult(
        input.vendorProductNames,
        "OpenAI returned a non-JSON response.",
      );
    }

    const validated = validateProductMatchResult(parsed, input.vendorProductNames);
    if (!validated) {
      return buildFailureMatchResult(
        input.vendorProductNames,
        "OpenAI response did not match the expected schema.",
      );
    }

    // Security: strip any product IDs not in the candidate list to prevent
    // hallucinated IDs being injected into the system.
    const validProductIds = new Set(limitedProducts.map(p => p.id));
    return {
      matches: validated.matches.map(m => ({
        ...m,
        suggestedProductId:
          m.suggestedProductId !== null && validProductIds.has(m.suggestedProductId)
            ? m.suggestedProductId
            : null,
        confidence:
          m.suggestedProductId !== null && !validProductIds.has(m.suggestedProductId)
            ? 0
            : m.confidence,
      })),
    };
  }
}
