import assert from "node:assert/strict";
import { test } from "node:test";

import OpenAI from "openai";

import {
  classifyOpenAiError,
  shouldEscalateAiFailure as shouldEscalate,
} from "./openai-error-classification";
import type { AiExtractionResult } from "../services/ai-provider";

// ---------------------------------------------------------------------------
// SDK error class → AiExtractionErrorCode mapping
//
// The SDK throws a small finite set of error classes. We bucket each into a
// coarse code that flows downstream into PipelineResult.parseErrorCodes +
// bulk_import_files.parse_error_codes. The mapping needs to stay in sync
// with the OpenAI SDK version pinned in package.json; if upgrading the SDK
// renames or restructures error classes these tests will surface it.
// ---------------------------------------------------------------------------

test("classifyOpenAiError: APIConnectionError → 'connection'", () => {
  const err = new OpenAI.APIConnectionError({
    message: "Connection error.",
    cause: new Error("ECONNRESET"),
  });
  const result = classifyOpenAiError(err);
  assert.equal(result.code, "connection");
  assert.match(result.message, /Connection error/);
});

test("classifyOpenAiError: APIConnectionTimeoutError → 'timeout'", () => {
  const err = new OpenAI.APIConnectionTimeoutError({
    message: "Request timed out.",
  });
  const result = classifyOpenAiError(err);
  assert.equal(result.code, "timeout");
});

test("classifyOpenAiError: RateLimitError → 'rate_limit'", () => {
  // RateLimitError constructor signature (status, error, message, headers).
  // The exact shape matters less than the type — the classifier uses
  // `instanceof`.
  const err = new OpenAI.RateLimitError(
    429,
    new Error("Rate limit exceeded"),
    "Rate limit exceeded",
    new Headers(),
  );
  const result = classifyOpenAiError(err);
  assert.equal(result.code, "rate_limit");
});

test("classifyOpenAiError: generic Error → 'unknown'", () => {
  const result = classifyOpenAiError(new Error("Something else"));
  assert.equal(result.code, "unknown");
  assert.equal(result.message, "Something else");
});

test("classifyOpenAiError: non-Error value → 'unknown' with stringified message", () => {
  const result = classifyOpenAiError("plain string failure");
  assert.equal(result.code, "unknown");
  assert.equal(result.message, "plain string failure");
});

// ---------------------------------------------------------------------------
// shouldEscalateAiFailure: escalation eligibility rules
//
// Keeps the contract pinned: only transient failures escalate, only when an
// escalation model is configured, only when the primary wasn't already on
// that model. Drift here would either cost real money (escalating on
// deterministic failures like refusal) or break the safety net (skipping
// escalation when it should fire).
// ---------------------------------------------------------------------------

function failedResult(errorCode: AiExtractionResult["errorCode"]): Pick<
  AiExtractionResult,
  "status" | "errorCode"
> {
  return { status: "failed", errorCode };
}

function successResult(): Pick<AiExtractionResult, "status" | "errorCode"> {
  return { status: "success", errorCode: null };
}

test("shouldEscalateAiFailure: connection failure on mini → escalates to gpt-4o", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("connection"),
  });
  assert.equal(result, true);
});

test("shouldEscalateAiFailure: timeout failure on mini → escalates", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("timeout"),
  });
  assert.equal(result, true);
});

test("shouldEscalateAiFailure: refusal failure → does NOT escalate (deterministic)", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("refusal"),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: post_validation failure → does NOT escalate", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("post_validation"),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: no_output failure → does NOT escalate", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("no_output"),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: rate_limit failure → does NOT escalate (SDK retries already)", () => {
  // Rate limits are handled by the SDK's built-in retry policy; bouncing to
  // a different model won't help if we're being rate-limited at the account
  // level. Keep escalation focused on connection/timeout.
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: failedResult("rate_limit"),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: success → does NOT escalate", () => {
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "gpt-4o",
    result: successResult(),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: connection failure when already on gpt-4o → does NOT escalate", () => {
  // No-op when there's no bigger model to escalate to. Avoids an infinite
  // retry loop if the user overrode OPENAI_INVOICE_MODEL=gpt-4o.
  const result = shouldEscalate({
    primaryModel: "gpt-4o",
    escalationModel: "gpt-4o",
    result: failedResult("connection"),
  });
  assert.equal(result, false);
});

test("shouldEscalateAiFailure: empty escalation model → escalation disabled", () => {
  // OPENAI_ESCALATION_MODEL="" disables escalation entirely. Caller gets
  // the bare primary failure (parse_error row in the queue). For
  // cost-sensitive environments that prefer hard failure over fallback.
  const result = shouldEscalate({
    primaryModel: "gpt-4o-mini",
    escalationModel: "",
    result: failedResult("connection"),
  });
  assert.equal(result, false);
});
