// SDK-error → AiExtractionErrorCode mapping + escalation-eligibility check.
// Lives in utils/ (no server-only import) so both can be unit-tested via the
// Node test runner without pulling in the OpenAI provider's server-only graph.

import OpenAI from "openai";

import type {
  AiExtractionErrorCode,
  AiExtractionResult,
} from "../services/ai-provider";

/**
 * Bucket an SDK / generic error into the coarse `AiExtractionErrorCode`
 * taxonomy that flows downstream into `PipelineResult.parseErrorCodes` and
 * `bulk_import_files.parse_error_codes`. The set of error classes the SDK
 * throws is small but the mapping needs to stay in sync with both the
 * pinned OpenAI SDK version and the downstream union — these classifiers
 * are exercised by `ai-provider-openai.test.ts`.
 */
export function classifyOpenAiError(err: unknown): {
  code: AiExtractionErrorCode;
  message: string;
} {
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return { code: "timeout", message: err.message };
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { code: "connection", message: err.message };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return { code: "rate_limit", message: err.message };
  }
  if (err instanceof OpenAI.BadRequestError) {
    // The SDK exposes `code` on the underlying API error for content-filter
    // refusals. Anything else from BadRequestError is bucketed as `unknown`
    // — typically a malformed request we want to investigate, not a
    // transient failure to retry.
    const apiCode = (err as { code?: string }).code;
    if (apiCode === "content_filter") return { code: "refusal", message: err.message };
    return { code: "unknown", message: err.message };
  }
  if (err instanceof OpenAI.APIError) {
    return { code: "unknown", message: err.message };
  }
  if (err instanceof Error) {
    return { code: "unknown", message: err.message };
  }
  return { code: "unknown", message: String(err) };
}

/**
 * Decide whether to retry a failed extraction with the configured escalation
 * model. Pure helper exported for tests — the OpenAI provider re-implements
 * the same logic as a private method, kept in sync deliberately so the test
 * pins the contract.
 *
 * Triggers only on TRANSIENT failures (connection/timeout). Refusals,
 * content_filter, and post-validation failures are deterministic — the
 * bigger model won't help, just spend tokens. Skipped when:
 *  - the primary call succeeded
 *  - escalation is disabled (`escalationModel === ""`)
 *  - the primary model IS the escalation model (already on the big one)
 */
export function shouldEscalateAiFailure(args: {
  primaryModel: string;
  escalationModel: string;
  result: Pick<AiExtractionResult, "status" | "errorCode">;
}): boolean {
  if (args.result.status !== "failed") return false;
  if (!args.escalationModel) return false;
  if (args.primaryModel === args.escalationModel) return false;
  return (
    args.result.errorCode === "connection" || args.result.errorCode === "timeout"
  );
}
