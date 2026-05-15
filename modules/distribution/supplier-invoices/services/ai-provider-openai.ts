import "server-only";

import OpenAI from "openai";

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
  safeParseJson,
  buildInvoiceExtractionUserMessage,
  buildProductMatchUserMessage,
} from "../utils/ai-validation";
import type {
  AiProvider,
  AiExtractionInput,
  AiExtractionResult,
  AiProductMatchInput,
  AiProductMatchResult,
  VisionExtractionInput,
} from "./ai-provider";

// ---------------------------------------------------------------------------
// Safe failure builders
// ---------------------------------------------------------------------------

function buildFailureExtractionResult(reason: string): AiExtractionResult {
  return {
    supplierName: null,
    supplierInvoiceNumber: null,
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
    this.client = new OpenAI({ apiKey: args.apiKey });
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

    let rawContent: string;

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

    return validated;
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

    let rawContent: string;
    let finishReason: string | null = null;

    try {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [fileContentPart, { type: "text", text: textHint }],
          },
        ],
        temperature: 0,
      });

      rawContent = response.choices[0]?.message?.content ?? "";
      finishReason = response.choices[0]?.finish_reason ?? null;

      if (input.debug) {
        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        console.log("[vision debug] response received", {
          finishReason,
          promptTokens,
          completionTokens,
          rawContentLength: rawContent.length,
          rawContentPreview: rawContent.slice(0, 500),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (input.debug) {
        console.error("[vision debug] API error", err);
      }
      return this.buildVisionFailureResult(`OpenAI API error: ${message}`);
    }

    if (!rawContent) {
      return this.buildVisionFailureResult(
        `Vision model returned empty content (finish_reason: ${finishReason}).`,
        rawContent,
      );
    }

    const parsed = safeParseJson(rawContent);
    if (parsed === null) {
      if (input.debug) {
        console.log("[vision debug] JSON parse failed, raw:", rawContent.slice(0, 1000));
      }
      return this.buildVisionFailureResult("Vision model returned a non-JSON response.", rawContent);
    }

    const validated = validateExtractionResult(parsed);
    if (!validated) {
      if (input.debug) {
        console.log("[vision debug] schema validation failed, parsed:", JSON.stringify(parsed).slice(0, 1000));
      }
      return this.buildVisionFailureResult(
        "Vision model response did not match the expected schema.",
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

    return { ...validated, rawJson: rawContent };
  }

  private buildVisionFailureResult(
    reason: string,
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
      warnings: [`Vision extraction failed: ${reason}`],
      reasoning: reason,
      rawJson,
    };
  }
}
