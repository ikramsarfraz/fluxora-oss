import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { classifyOpenAiError } from "@/modules/distribution/supplier-invoices/utils/openai-error-classification";

import { ORDER_EXTRACTION_SYSTEM_PROMPT } from "../utils/ai-prompts";
import {
  AiOrderExtractionResultSchema,
  DEFAULT_MAX_CUSTOMER_CANDIDATES,
  DEFAULT_MAX_ORDER_PRODUCT_CANDIDATES,
  DEFAULT_MAX_ORDER_TEXT_CHARS,
  buildOrderExtractionUserMessage,
  limitCustomerCandidates,
  limitOrderProductCandidates,
  truncateOrderText,
  validateOrderExtractionResult,
  type ValidatedOrderExtractionResult,
} from "../utils/ai-order-validation";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AiOrderExtractionInput = {
  rawText: string;
  /** ISO YYYY-MM-DD. Provided by the caller so the prompt's relative-date
   *  resolution is reproducible in tests. */
  today: string;
  candidateCustomers: Array<{ id: string; name: string }>;
  candidateProducts: Array<{ id: string; name: string; sku: string | null }>;
};

/**
 * Coarse failure taxonomy — mirrors the supplier-invoice
 * `AiExtractionErrorCode` shape on purpose so the cost-tracking + dashboards
 * can roll up both surfaces. Kept as its own local union to avoid taking
 * a value-import dep on the supplier-invoice provider abstraction.
 */
export type AiOrderExtractionErrorCode =
  | "connection"
  | "timeout"
  | "rate_limit"
  | "refusal"
  | "post_validation"
  | "no_output"
  | "not_configured"
  | "unknown";

export type AiOrderCallUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export type AiOrderExtractionResult = ValidatedOrderExtractionResult & {
  status: "success" | "failed";
  errorCode: AiOrderExtractionErrorCode | null;
  errorMessage: string | null;
  usage: AiOrderCallUsage | null;
};

// ---------------------------------------------------------------------------
// Provider wiring — direct OpenAI SDK use, no abstraction layer.
//
// The supplier-invoice surface has an `AiProvider` abstraction because it
// supports text + vision + product-match calls and is going to grow more
// provider implementations (Anthropic, Gemini). The order paste-text flow
// is a single SDK call; abstracting it would just be code overhead.
// If/when this surface needs to swap providers, lift these helpers into
// `modules/shared/ai/` alongside the supplier-invoice abstraction.
// ---------------------------------------------------------------------------

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (_client !== null) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({
    apiKey,
    maxRetries: 3,
    timeout: 60_000,
  });
  return _client;
}

/** Test seam — `_setOrderAiClientForTest(stub)` swaps the SDK for a stub. */
export function _setOrderAiClientForTest(client: OpenAI | null): void {
  _client = client;
}

function resolveMaxInt(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

// ---------------------------------------------------------------------------
// Failure builders — kept symmetric with the supplier-invoice provider so
// the cost-tracking layer can ingest both.
// ---------------------------------------------------------------------------

function emptyValidated(): ValidatedOrderExtractionResult {
  return {
    customerHint: null,
    requestedDate: null,
    lines: [],
    customerNotes: null,
    internalNotes: null,
    confidence: 0,
    warnings: [],
    reasoning: "",
  };
}

function buildFailureResult(args: {
  errorCode: AiOrderExtractionErrorCode;
  errorMessage: string;
  usage?: AiOrderCallUsage | null;
}): AiOrderExtractionResult {
  return {
    ...emptyValidated(),
    warnings: [`AI order extraction failed: ${args.errorMessage}`],
    reasoning: args.errorMessage,
    status: "failed",
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
    usage: args.usage ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractSalesOrderFromText(
  input: AiOrderExtractionInput,
): Promise<AiOrderExtractionResult> {
  const client = getClient();
  if (!client) {
    return buildFailureResult({
      errorCode: "not_configured",
      errorMessage:
        "OPENAI_API_KEY is not set. Set it (or AI_PROVIDER=openai with OPENAI_API_KEY) to enable AI order parsing.",
    });
  }

  const model = process.env.OPENAI_ORDER_MODEL ?? "gpt-4o-mini";
  const maxTextChars = resolveMaxInt(
    process.env.AI_MAX_ORDER_TEXT_CHARS,
    DEFAULT_MAX_ORDER_TEXT_CHARS,
  );
  const maxCustomerCandidates = resolveMaxInt(
    process.env.AI_MAX_CUSTOMER_CANDIDATES,
    DEFAULT_MAX_CUSTOMER_CANDIDATES,
  );
  const maxProductCandidates = resolveMaxInt(
    process.env.AI_MAX_PRODUCT_CANDIDATES,
    DEFAULT_MAX_ORDER_PRODUCT_CANDIDATES,
  );

  const userMessage = buildOrderExtractionUserMessage({
    rawText: truncateOrderText(input.rawText, maxTextChars),
    today: input.today,
    candidateCustomers: limitCustomerCandidates(
      input.candidateCustomers,
      maxCustomerCandidates,
    ),
    candidateProducts: limitOrderProductCandidates(
      input.candidateProducts,
      maxProductCandidates,
    ),
  });

  let parsed: unknown;
  let usage: AiOrderCallUsage | null = null;

  try {
    const response = await client.chat.completions.parse({
      model,
      response_format: zodResponseFormat(
        AiOrderExtractionResultSchema,
        "order_extraction",
      ),
      messages: [
        { role: "system", content: ORDER_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    });

    usage = {
      model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };

    const message = response.choices[0]?.message;
    if (message?.refusal) {
      return buildFailureResult({
        errorCode: "refusal",
        errorMessage: `OpenAI refused to answer: ${message.refusal}`,
        usage,
      });
    }
    parsed = message?.parsed;
    if (parsed == null) {
      return buildFailureResult({
        errorCode: "no_output",
        errorMessage: "OpenAI returned no parsed output.",
        usage,
      });
    }
  } catch (err) {
    const { code, message } = classifyOpenAiError(err);
    // `classifyOpenAiError` returns the supplier-invoice error union; both
    // unions overlap on the codes that can actually come from the SDK
    // (connection / timeout / rate_limit / refusal / unknown). Cast is safe
    // because we never expect `post_validation` or `no_output` to come from
    // the classifier — those are produced by the post-call paths below.
    return buildFailureResult({
      errorCode: code as AiOrderExtractionErrorCode,
      errorMessage: `OpenAI API error: ${message}`,
    });
  }

  const validated = validateOrderExtractionResult(parsed);
  if (!validated) {
    return buildFailureResult({
      errorCode: "post_validation",
      errorMessage: "OpenAI response failed post-validation.",
      usage,
    });
  }

  return {
    ...validated,
    status: "success",
    errorCode: null,
    errorMessage: null,
    usage,
  };
}
