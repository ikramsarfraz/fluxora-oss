import "server-only";

import OpenAI from "openai";

import {
  VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT,
  buildVisionInvoiceUserMessage,
} from "../utils/vision-prompts";
import { safeParseJson, validateExtractionResult } from "../utils/ai-validation";
import type { AiExtractionResult } from "./ai-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisionExtractionInput = {
  pdfBuffer: Buffer;
  filename: string;
  extractedText?: string;
  supplierHints?: string[];
  candidateSuppliers?: Array<{ id: string; name: string }>;
  debug?: boolean;
};

export type VisionExtractionResult = AiExtractionResult & {
  visionUsed: true;
  rawVisionJson: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VISION_MODEL = "gpt-4o";
// 20 MB — OpenAI file content practical limit for inline base64
const MAX_PDF_BYTES_FOR_VISION = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFailureResult(reason: string, rawContent = ""): VisionExtractionResult {
  return {
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    totalAmount: null,
    subtotal: null,
    fees: [],
    lines: [],
    confidence: 0,
    warnings: [`Vision extraction failed: ${reason}`],
    reasoning: reason,
    visionUsed: true,
    rawVisionJson: rawContent,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function extractSupplierInvoiceWithVision(
  input: VisionExtractionInput,
): Promise<VisionExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildFailureResult("OPENAI_API_KEY not configured.");
  }

  if (input.pdfBuffer.byteLength > MAX_PDF_BYTES_FOR_VISION) {
    return buildFailureResult(
      `PDF exceeds maximum vision input size (${MAX_PDF_BYTES_FOR_VISION / (1024 * 1024)} MB).`,
    );
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_VISION_MODEL ?? DEFAULT_VISION_MODEL;

  // OpenAI file content parts require a data URL with MIME type prefix.
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

  let rawContent: string;
  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason: string | null = null;

  try {
    const response = await client.chat.completions.create({
      model,
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
    if (response.usage) {
      promptTokens = response.usage.prompt_tokens;
      completionTokens = response.usage.completion_tokens;
    }

    if (input.debug) {
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
    return buildFailureResult(`OpenAI API error: ${message}`);
  }

  if (!rawContent) {
    return buildFailureResult(
      `Vision model returned empty content (finish_reason: ${finishReason}).`,
      rawContent,
    );
  }

  const parsed = safeParseJson(rawContent);
  if (parsed === null) {
    if (input.debug) {
      console.log("[vision debug] JSON parse failed, raw:", rawContent.slice(0, 1000));
    }
    return buildFailureResult("Vision model returned a non-JSON response.", rawContent);
  }

  const validated = validateExtractionResult(parsed);
  if (!validated) {
    if (input.debug) {
      console.log("[vision debug] schema validation failed, parsed:", JSON.stringify(parsed).slice(0, 1000));
    }
    return buildFailureResult("Vision model response did not match the expected schema.", rawContent);
  }

  if (input.debug) {
    console.log("[vision debug] extraction succeeded", {
      lines: validated.lines.length,
      firstLine: validated.lines[0] ?? null,
      totalAmount: validated.totalAmount,
      confidence: validated.confidence,
    });
  }

  const tokenInfo = `Vision tokens: ${promptTokens + completionTokens} (prompt: ${promptTokens}, completion: ${completionTokens})`;

  return {
    ...validated,
    warnings: [...validated.warnings, tokenInfo],
    visionUsed: true,
    rawVisionJson: rawContent,
  };
}
