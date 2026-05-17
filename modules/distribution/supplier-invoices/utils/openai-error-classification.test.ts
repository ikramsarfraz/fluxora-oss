import assert from "node:assert/strict";
import { test } from "node:test";

import OpenAI from "openai";

import { classifyOpenAiError } from "./openai-error-classification";

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
