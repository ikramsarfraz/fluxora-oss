import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { INVOICE_EXTRACTION_SYSTEM_PROMPT, PRODUCT_MATCH_SYSTEM_PROMPT } from "../utils/ai-prompts";
import {
  VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT,
  buildVisionInvoiceUserMessage,
} from "../utils/vision-prompts";
import {
  truncateInvoiceText,
  limitProductCandidates,
  validateExtractionResult,
  validateProductMatchResult,
  buildInvoiceExtractionUserMessage,
  buildProductMatchUserMessage,
  AiExtractionResultSchema,
  AiProductMatchResultSchema,
} from "../utils/ai-validation";
import { classifyOpenAiError } from "../utils/openai-error-classification";
import type {
  AiProvider,
  AiExtractionInput,
  AiExtractionResult,
  AiExtractionErrorCode,
  AiProductMatchInput,
  AiProductMatchResult,
  VisionExtractionInput,
} from "./ai-provider";

// ---------------------------------------------------------------------------
// Safe failure builders
// ---------------------------------------------------------------------------

function buildFailureExtractionResult(args: {
  errorCode: AiExtractionErrorCode;
  errorMessage: string;
}): AiExtractionResult {
  return {
    supplierName: null,
    supplierInvoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
    fees: [],
    lines: [],
    confidence: 0,
    warnings: [`AI extraction failed: ${args.errorMessage}`],
    reasoning: args.errorMessage,
    status: "failed",
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
  };
}

/**
 * The "model ran but didn't produce a usable result" case — refusal text, an
 * empty parsed payload, or a structured-output post-validation failure. These
 * are distinct from a thrown SDK error because there's no retry that would
 * help; the model legitimately decided not to give us data.
 */
function buildNoOutputExtractionResult(args: {
  errorCode: Extract<AiExtractionErrorCode, "no_output" | "refusal" | "post_validation">;
  errorMessage: string;
}): AiExtractionResult {
  return {
    supplierName: null,
    supplierInvoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
    fees: [],
    lines: [],
    confidence: 0,
    warnings: [`AI extraction failed: ${args.errorMessage}`],
    reasoning: args.errorMessage,
    status: "failed",
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
  };
}

function buildFailureMatchResult(
  vendorProductNames: string[],
  args: { errorCode: AiExtractionErrorCode; errorMessage: string },
): AiProductMatchResult {
  return {
    matches: vendorProductNames.map(name => ({
      vendorProductName: name,
      suggestedProductId: null,
      confidence: 0,
      reasoning: `AI matching failed: ${args.errorMessage}`,
    })),
    status: "failed",
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
  };
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly invoiceModel: string;
  private readonly productMatchModel: string;
  private readonly visionModel: string;
  private readonly maxInvoiceTextChars: number;
  private readonly maxProductCandidates: number;

  constructor(args: {
    apiKey: string;
    invoiceModel: string;
    productMatchModel: string;
    visionModel: string;
    maxInvoiceTextChars: number;
    maxProductCandidates: number;
  }) {
    // Long multipage-invoice completions can take 80+ seconds, which raises the
    // odds of transient connection drops mid-response. SDK default is 2; bump
    // to 4 for the long-call case. Retries use exponential backoff and only
    // fire on APIConnectionError, RateLimitError, and 5xx — they don't slow
    // the happy path.
    this.client = new OpenAI({ apiKey: args.apiKey, maxRetries: 4 });
    this.invoiceModel = args.invoiceModel;
    this.productMatchModel = args.productMatchModel;
    this.visionModel = args.visionModel;
    this.maxInvoiceTextChars = args.maxInvoiceTextChars;
    this.maxProductCandidates = args.maxProductCandidates;
  }

  isAvailable(): boolean {
    return true;
  }

  isVisionCapable(): boolean {
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

    let parsed: unknown;

    try {
      // Strict structured outputs: the SDK rejects any response that doesn't
      // match `AiExtractionResultSchema` shape, so we never need to repair
      // malformed JSON afterwards. Refusals surface as `parsed === null`
      // (model declined to answer) which we handle below.
      const response = await this.client.chat.completions.parse({
        model: this.invoiceModel,
        response_format: zodResponseFormat(AiExtractionResultSchema, "invoice_extraction"),
        messages: [
          { role: "system", content: INVOICE_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      });

      const message = response.choices[0]?.message;
      if (message?.refusal) {
        return buildNoOutputExtractionResult({
          errorCode: "refusal",
          errorMessage: `OpenAI refused to answer: ${message.refusal}`,
        });
      }
      parsed = message?.parsed;
      if (parsed == null) {
        return buildNoOutputExtractionResult({
          errorCode: "no_output",
          errorMessage: "OpenAI returned no parsed output.",
        });
      }
    } catch (err) {
      const { code, message } = classifyOpenAiError(err);
      return buildFailureExtractionResult({
        errorCode: code,
        errorMessage: `OpenAI API error: ${message}`,
      });
    }

    // Schema-level validation is already done by structured outputs, but the
    // post-validation step still does *business* sanitisation: numeric
    // supplier-name rejection, ISO-date normalisation, per-line caseWeights
    // length check, and the empty-result guard.
    const validated = validateExtractionResult(parsed);
    if (!validated) {
      return buildNoOutputExtractionResult({
        errorCode: "post_validation",
        errorMessage: "OpenAI response failed post-validation.",
      });
    }

    return { ...validated, status: "success", errorCode: null, errorMessage: null };
  }

  async suggestProductMatches(input: AiProductMatchInput): Promise<AiProductMatchResult> {
    if (input.vendorProductNames.length === 0) {
      // Legitimately nothing to match — success-with-empty.
      return { matches: [], status: "success", errorCode: null, errorMessage: null };
    }

    const limitedProducts = limitProductCandidates(
      input.candidateProducts,
      this.maxProductCandidates,
    );

    const userMessage = buildProductMatchUserMessage({
      vendorProductNames: input.vendorProductNames,
      candidateProducts: limitedProducts,
    });

    let parsed: unknown;

    try {
      const response = await this.client.chat.completions.parse({
        model: this.productMatchModel,
        response_format: zodResponseFormat(AiProductMatchResultSchema, "product_match"),
        messages: [
          { role: "system", content: PRODUCT_MATCH_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      });

      const message = response.choices[0]?.message;
      if (message?.refusal) {
        return buildFailureMatchResult(input.vendorProductNames, {
          errorCode: "refusal",
          errorMessage: `OpenAI refused to answer: ${message.refusal}`,
        });
      }
      parsed = message?.parsed;
      if (parsed == null) {
        return buildFailureMatchResult(input.vendorProductNames, {
          errorCode: "no_output",
          errorMessage: "OpenAI returned no parsed output.",
        });
      }
    } catch (err) {
      const { code, message } = classifyOpenAiError(err);
      return buildFailureMatchResult(input.vendorProductNames, {
        errorCode: code,
        errorMessage: `OpenAI API error: ${message}`,
      });
    }

    const validated = validateProductMatchResult(parsed, input.vendorProductNames);
    if (!validated) {
      return buildFailureMatchResult(input.vendorProductNames, {
        errorCode: "post_validation",
        errorMessage: "OpenAI response failed post-validation.",
      });
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
      status: "success",
      errorCode: null,
      errorMessage: null,
    };
  }

  async extractInvoiceFromPdf(
    input: VisionExtractionInput,
  ): Promise<AiExtractionResult & { rawJson: string }> {
    const pdfDataUrl = `data:application/pdf;base64,${input.pdfBuffer.toString("base64")}`;

    const textHint = buildVisionInvoiceUserMessage({
      filename: input.filename,
      extractedText: input.extractedText,
      supplierHints: input.supplierHints,
      candidateSuppliers: input.candidateSuppliers,
    });

    const fileContentPart: OpenAI.Chat.Completions.ChatCompletionContentPart.File = {
      type: "file",
      file: {
        filename: input.filename,
        file_data: pdfDataUrl,
      },
    };

    if (input.debug) {
      console.log("[vision debug] sending request", {
        model: this.visionModel,
        pdfBytes: input.pdfBuffer.byteLength,
        filename: input.filename,
        contentParts: ["file", "text"],
        textHintLength: textHint.length,
      });
    }

    let parsed: unknown;
    let rawContent = "";
    let finishReason: string | null = null;

    try {
      const response = await this.client.chat.completions.parse({
        model: this.visionModel,
        response_format: zodResponseFormat(AiExtractionResultSchema, "invoice_extraction"),
        messages: [
          { role: "system", content: VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [fileContentPart, { type: "text", text: textHint }],
          },
        ],
        temperature: 0,
      });

      const message = response.choices[0]?.message;
      finishReason = response.choices[0]?.finish_reason ?? null;
      rawContent = message?.content ?? "";

      if (input.debug) {
        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        console.log("[vision debug] response received", {
          finishReason,
          promptTokens,
          completionTokens,
          rawContentLength: rawContent.length,
          parsedPresent: message?.parsed != null,
        });
      }

      if (message?.refusal) {
        return this.buildVisionFailureResult(
          {
            errorCode: "refusal",
            errorMessage: `Vision model refused to answer: ${message.refusal}`,
          },
          rawContent,
        );
      }

      parsed = message?.parsed;
      if (parsed == null) {
        return this.buildVisionFailureResult(
          {
            errorCode: "no_output",
            errorMessage: `Vision model returned no parsed output (finish_reason: ${finishReason}).`,
          },
          rawContent,
        );
      }
    } catch (err) {
      const { code, message } = classifyOpenAiError(err);
      if (input.debug) {
        console.error("[vision debug] API error", err);
      }
      return this.buildVisionFailureResult({
        errorCode: code,
        errorMessage: `OpenAI API error: ${message}`,
      });
    }

    const validated = validateExtractionResult(parsed);
    if (!validated) {
      if (input.debug) {
        console.log(
          "[vision debug] post-validation failed, parsed:",
          JSON.stringify(parsed).slice(0, 1000),
        );
      }
      return this.buildVisionFailureResult(
        {
          errorCode: "post_validation",
          errorMessage: "Vision model response failed post-validation.",
        },
        rawContent,
      );
    }

    if (input.debug) {
      console.log("[vision debug] extraction succeeded", {
        lines: validated.lines.length,
        firstLine: validated.lines[0] ?? null,
        totalAmount: validated.totalAmount,
        confidence: validated.confidence,
      });
    }

    return {
      ...validated,
      rawJson: rawContent,
      status: "success",
      errorCode: null,
      errorMessage: null,
    };
  }

  private buildVisionFailureResult(
    args: { errorCode: AiExtractionErrorCode; errorMessage: string },
    rawJson = "",
  ): AiExtractionResult & { rawJson: string } {
    return {
      supplierName: null,
      supplierInvoiceNumber: null,
      invoiceDate: null,
      totalAmount: null,
      subtotal: null,
      fees: [],
      lines: [],
      confidence: 0,
      warnings: [`Vision extraction failed: ${args.errorMessage}`],
      reasoning: args.errorMessage,
      rawJson,
      status: "failed",
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
    };
  }
}
