import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { calculateAiCostMicros } from "@/lib/ai-cost";

import {
  RECEIPT_EXTRACTION_SYSTEM_PROMPT,
  ReceiptExtractionPayloadSchema,
  buildReceiptUserMessage,
  validateReceiptPayload,
  type ReceiptExtractionPayload,
} from "../utils/receipt-vision-prompts";

// ---------------------------------------------------------------------------
// Vendored, intentionally minimal OpenAI wrapper for receipt OCR. The
// supplier-invoices module has a richer provider abstraction (escalation,
// retry caps, mock fallback, vision dispatch heuristic) but reaching across
// to it would couple two distribution domains. Receipts are simple enough —
// one model, no escalation, ~50 lines of glue — that an in-module helper is
// cheaper than the cross-module refactor.
//
// Reuses the shared cost-tracking writer + `ai_usage_events` schema so spend
// shows up in the platform-admin dashboard alongside bill parses.
// ---------------------------------------------------------------------------

export type ReceiptExtractionErrorCode =
  | "connection"
  | "timeout"
  | "rate_limit"
  | "refusal"
  | "post_validation"
  | "no_output"
  | "provider_unavailable"
  | "unknown";

export type ReceiptExtractionResult = {
  vendorName: string | null;
  transactionDate: string | null;
  totalAmount: string | null;
  currency: string | null;
  paymentMethodHint: ReceiptExtractionPayload["paymentMethodHint"];
  confidence: number;
  reasoning: string;
  warnings: string[];
  rawJson: string;
  status: "success" | "failed";
  errorCode: ReceiptExtractionErrorCode | null;
  errorMessage: string | null;
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
  } | null;
};

const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PDF_MIME = "application/pdf";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches expense_attachments cap.

function failed(args: {
  errorCode: ReceiptExtractionErrorCode;
  errorMessage: string;
  usage?: ReceiptExtractionResult["usage"];
  rawJson?: string;
}): ReceiptExtractionResult {
  return {
    vendorName: null,
    transactionDate: null,
    totalAmount: null,
    currency: null,
    paymentMethodHint: null,
    confidence: 0,
    reasoning: args.errorMessage,
    warnings: [`Receipt extraction failed: ${args.errorMessage}`],
    rawJson: args.rawJson ?? "",
    status: "failed",
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
    usage: args.usage ?? null,
  };
}

function classifyOpenAiError(err: unknown): {
  code: ReceiptExtractionErrorCode;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (err instanceof OpenAI.APIConnectionTimeoutError || lower.includes("timeout")) {
    return { code: "timeout", message };
  }
  if (err instanceof OpenAI.APIConnectionError || lower.includes("socket")) {
    return { code: "connection", message };
  }
  if (err instanceof OpenAI.RateLimitError) return { code: "rate_limit", message };
  return { code: "unknown", message };
}

export type ExtractReceiptArgs = {
  bytes: Buffer;
  mimeType: string;
  filename: string;
};

export async function extractReceiptFromUpload(
  args: ExtractReceiptArgs,
): Promise<ReceiptExtractionResult> {
  if (args.bytes.byteLength === 0) {
    return failed({ errorCode: "no_output", errorMessage: "Empty file." });
  }
  if (args.bytes.byteLength > MAX_BYTES) {
    return failed({
      errorCode: "no_output",
      errorMessage: `Receipt too large (max ${MAX_BYTES / (1024 * 1024)} MB).`,
    });
  }

  const mime = args.mimeType.toLowerCase();
  const isPdf = mime === PDF_MIME;
  const isImage = SUPPORTED_IMAGE_MIME.has(mime);
  if (!isPdf && !isImage) {
    return failed({
      errorCode: "no_output",
      errorMessage: `Unsupported file type "${mime}". Use a JPEG, PNG, WebP, or PDF.`,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const useMock =
    process.env.AI_PROVIDER === "mock" ||
    (!apiKey && process.env.AI_PROVIDER !== "openai");
  if (useMock || !apiKey) {
    return failed({
      errorCode: "provider_unavailable",
      errorMessage:
        "AI receipt extraction is not configured. Set AI_PROVIDER=openai and OPENAI_API_KEY to enable.",
    });
  }

  const client = new OpenAI({ apiKey, maxRetries: 3, timeout: 60_000 });
  const model = process.env.OPENAI_RECEIPT_MODEL ?? process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
  const dataUrl = `data:${mime};base64,${args.bytes.toString("base64")}`;
  const userText = buildReceiptUserMessage({ filename: args.filename });

  const mediaPart: OpenAI.Chat.Completions.ChatCompletionContentPart = isPdf
    ? {
        type: "file",
        file: { filename: args.filename, file_data: dataUrl },
      }
    : {
        type: "image_url",
        image_url: { url: dataUrl, detail: "high" },
      };

  let rawContent = "";
  let usage: ReceiptExtractionResult["usage"] = null;

  try {
    const response = await client.chat.completions.parse({
      model,
      response_format: zodResponseFormat(
        ReceiptExtractionPayloadSchema,
        "receipt_extraction",
      ),
      messages: [
        { role: "system", content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [mediaPart, { type: "text", text: userText }],
        },
      ],
      temperature: 0,
    });

    const message = response.choices[0]?.message;
    rawContent = message?.content ?? "";
    usage = {
      model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };

    if (message?.refusal) {
      return failed({
        errorCode: "refusal",
        errorMessage: `Model refused to answer: ${message.refusal}`,
        usage,
        rawJson: rawContent,
      });
    }

    const parsed = message?.parsed;
    if (parsed == null) {
      return failed({
        errorCode: "no_output",
        errorMessage: "Model returned no parsed output.",
        usage,
        rawJson: rawContent,
      });
    }

    const validated = validateReceiptPayload(parsed);
    if (!validated) {
      return failed({
        errorCode: "post_validation",
        errorMessage: "Receipt response failed post-validation.",
        usage,
        rawJson: rawContent,
      });
    }

    return {
      ...validated,
      warnings: [],
      rawJson: rawContent,
      status: "success",
      errorCode: null,
      errorMessage: null,
      usage,
    };
  } catch (err) {
    const { code, message } = classifyOpenAiError(err);
    return failed({
      errorCode: code,
      errorMessage: `OpenAI API error: ${message}`,
      usage,
      rawJson: rawContent,
    });
  }
}

/**
 * Persist a single receipt-extraction call as an `ai_usage_events` row. Best-
 * effort: a failure here never breaks the user's form-prefill flow. Reuses
 * the `vision_extraction` stage enum value — receipt OCR is a vision call;
 * the dashboard can disambiguate by `sourceFilename` when needed. Adding a
 * dedicated stage is a follow-up once volume warrants the migration.
 */
export async function recordReceiptUsage(input: {
  tenantId: string;
  portalUserId: string | null;
  sourceFilename: string;
  result: ReceiptExtractionResult;
}): Promise<void> {
  const usage = input.result.usage;
  if (!usage) return; // Provider unavailable / connection error before usage.
  try {
    await db.insert(aiUsageEvents).values({
      tenantId: input.tenantId,
      portalUserId: input.portalUserId,
      stage: "vision_extraction",
      model: usage.model,
      escalatedFromModel: null,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costMicros: calculateAiCostMicros({
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      }),
      succeeded: input.result.status === "success",
      errorCode: input.result.errorCode,
      sourceBulkImportFileId: null,
      sourceFilename: input.sourceFilename.slice(0, 512),
    });
  } catch (err) {
    console.warn("[receipt-extraction] failed to record usage event", err);
  }
}
