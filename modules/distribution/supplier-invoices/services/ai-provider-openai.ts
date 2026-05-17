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
import {
  classifyOpenAiError,
  shouldEscalateAiFailure,
} from "../utils/openai-error-classification";
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
  /**
   * Larger model used as a one-shot fallback when the primary call fails
   * with a transient connection/timeout error. Empty string disables
   * escalation entirely.
   */
  private readonly escalationModel: string;
  private readonly maxInvoiceTextChars: number;
  private readonly maxProductCandidates: number;

  constructor(args: {
    apiKey: string;
    invoiceModel: string;
    productMatchModel: string;
    visionModel: string;
    escalationModel: string;
    maxInvoiceTextChars: number;
    maxProductCandidates: number;
    /**
     * Test-only seam. When provided, replaces the OpenAI client this
     * provider would otherwise construct. Lets the integration test inject
     * a stub that drives the escalation path (mini-fails → gpt-4o-succeeds)
     * without hitting the real OpenAI API. Production paths always pass
     * `undefined` here.
     */
    clientForTest?: OpenAI;
  }) {
    // `timeout` caps each individual request; without it, a stuck socket can
    // hang for minutes (real observation: 10.3 min when OpenAI dropped both
    // text-AI and vision sockets mid-stream and the SDK kept retrying). 60s
    // is well above the happy-path budget (~3-5s on mini for a typical small
    // invoice, ~12-30s on gpt-4o for a 100-line one) but short enough to
    // fail fast when the remote stops talking.
    //
    // `maxRetries: 3` pairs with the timeout to bound worst-case end-to-end:
    // (3+1) × 60s × 2 stages = 8 min worst case, vs. 10+ min without the cap.
    // Retries still only fire on APIConnectionError/RateLimitError/5xx, and
    // most successful calls finish on the first attempt.
    this.client =
      args.clientForTest ??
      new OpenAI({
        apiKey: args.apiKey,
        maxRetries: 3,
        timeout: 60_000,
      });
    this.invoiceModel = args.invoiceModel;
    this.productMatchModel = args.productMatchModel;
    this.visionModel = args.visionModel;
    this.escalationModel = args.escalationModel;
    this.maxInvoiceTextChars = args.maxInvoiceTextChars;
    this.maxProductCandidates = args.maxProductCandidates;
  }

  /**
   * Thin wrapper over the pure helper in `utils/openai-error-classification`,
   * which is the single source of truth for the escalation rules + has the
   * unit tests. Kept here so the call sites read cleanly.
   */
  private shouldEscalate(
    primaryModel: string,
    failure: AiExtractionResult,
  ): boolean {
    return shouldEscalateAiFailure({
      primaryModel,
      escalationModel: this.escalationModel,
      result: failure,
    });
  }

  /**
   * Warning appended to the result when escalation produces a successful
   * parse. Surfaces in the Review screen warnings list + the
   * bulk_import_files.pipeline_result.warnings for visibility — repeated
   * escalations are a signal to lower the model default or scale up the
   * primary tier.
   */
  private escalationWarning(primaryModel: string): string {
    return (
      `AI extraction escalated to '${this.escalationModel}' after '${primaryModel}'` +
      ` returned a transient connection/timeout error. Each escalation costs` +
      ` roughly 17× more than the primary call.`
    );
  }

  isAvailable(): boolean {
    return true;
  }

  isVisionCapable(): boolean {
    return true;
  }

  async extractSupplierInvoice(input: AiExtractionInput): Promise<AiExtractionResult> {
    const primary = await this.runInvoiceExtraction(input, this.invoiceModel);
    if (!this.shouldEscalate(this.invoiceModel, primary)) return primary;

    // Transient failure on the primary model — retry once with the
    // escalation model. If the escalation succeeds, append a warning so the
    // cost spike is visible in the Review screen + bulk_import_files row.
    // If it also fails, we return the escalation's failure (more recent
    // signal beats the original) so the resulting parseErrorCodes reflect
    // both attempts having been exhausted.
    const escalated = await this.runInvoiceExtraction(input, this.escalationModel);
    if (escalated.status === "success") {
      return {
        ...escalated,
        warnings: [...escalated.warnings, this.escalationWarning(this.invoiceModel)],
      };
    }
    return escalated;
  }

  /**
   * The actual extraction call — single attempt against a specified model.
   * Pulled out of `extractSupplierInvoice` so the escalation path can re-run
   * with a different model parameter. Behaviour is identical to the prior
   * inline implementation; only the model became a parameter.
   */
  private async runInvoiceExtraction(
    input: AiExtractionInput,
    model: string,
  ): Promise<AiExtractionResult> {
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
        model,
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
    const primary = await this.runVisionExtraction(input, this.visionModel);
    if (!this.shouldEscalate(this.visionModel, primary)) return primary;

    // Same pattern as extractSupplierInvoice — retry once on the bigger
    // model when the primary failed transiently. Successful escalation
    // appends a warning so cost spikes are visible in the Review screen.
    const escalated = await this.runVisionExtraction(input, this.escalationModel);
    if (escalated.status === "success") {
      return {
        ...escalated,
        warnings: [...escalated.warnings, this.escalationWarning(this.visionModel)],
      };
    }
    return escalated;
  }

  /**
   * Single-attempt vision extraction against a specified model. Pulled out
   * of `extractInvoiceFromPdf` so the escalation path can re-run with the
   * larger model. Behaviour is identical to the prior inline implementation.
   */
  private async runVisionExtraction(
    input: VisionExtractionInput,
    model: string,
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
        model,
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
        model,
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
