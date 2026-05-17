import assert from "node:assert/strict";
import { test } from "node:test";

import OpenAI from "openai";

import { OpenAiProvider } from "./ai-provider-openai";
import type { AiExtractionInput, VisionExtractionInput } from "./ai-provider";

// ---------------------------------------------------------------------------
// Escalation integration tests
//
// Drives the wrappers in extractSupplierInvoice + extractInvoiceFromPdf by
// injecting a stub OpenAI client (via `clientForTest`) instead of mocking
// the HTTP layer. The stub's `chat.completions.parse` records each call's
// model and returns a canned response based on the call sequence.
//
// What this catches that the unit tests in
// `utils/openai-error-classification.test.ts` don't:
//   - That escalation actually re-invokes the SDK with the escalation model
//   - That the escalation warning is appended on success
//   - That `runInvoiceExtraction` and `runVisionExtraction` both wire
//     through the helper correctly
// ---------------------------------------------------------------------------

type ParseFn = (args: { model: string }) => Promise<unknown>;

function makeStubClient(parse: ParseFn): OpenAI {
  // Cast through `unknown` because OpenAI's type is deep + nominal; we only
  // touch the one method the provider uses.
  return {
    chat: {
      completions: {
        parse,
      },
    },
  } as unknown as OpenAI;
}

function makeProvider(args: {
  client: OpenAI;
  invoiceModel?: string;
  visionModel?: string;
  escalationModel?: string;
}): OpenAiProvider {
  return new OpenAiProvider({
    apiKey: "test-key-not-used",
    invoiceModel: args.invoiceModel ?? "gpt-4o-mini",
    productMatchModel: "gpt-4o-mini",
    visionModel: args.visionModel ?? "gpt-4o-mini",
    escalationModel: args.escalationModel ?? "gpt-4o",
    maxInvoiceTextChars: 30_000,
    maxProductCandidates: 75,
    clientForTest: args.client,
  });
}

/** Minimal shape the provider expects from `chat.completions.parse`. */
function successResponse(parsed: unknown) {
  return {
    choices: [{ message: { parsed, refusal: null } }],
  };
}

/** Schema-shaped success payload — passes `validateExtractionResult`. */
function validInvoicePayload() {
  return {
    supplierName: "ALI TRADERS",
    supplierInvoiceNumber: "57876",
    invoiceDate: "2026-04-20",
    totalAmount: 147086,
    subtotal: null,
    fees: [],
    lines: [
      {
        vendorProductName: "CHICKEN TENDERS",
        vendorProductDescription: null,
        quantityCases: 4,
        quantityWeight: 160,
        caseWeights: null,
        unitPrice: 1.0,
        lineTotal: 160.0,
        unitType: "catch_weight",
        notes: null,
      },
    ],
    confidence: 92,
    warnings: [],
    reasoning: "Stub.",
  };
}

const SAMPLE_EXTRACTION_INPUT: AiExtractionInput = {
  filename: "test.pdf",
  extractedText: "ALI TRADERS\nCHICKEN TENDERS 4 160 1.00 160.00\nBALANCE DUE: $160.00",
  supplierHints: ["ALI TRADERS"],
  candidateSuppliers: [],
  candidateProducts: [],
};

const SAMPLE_VISION_INPUT: VisionExtractionInput = {
  pdfBuffer: Buffer.from("%PDF-1.4 stub"),
  filename: "test.pdf",
  extractedText: "ALI TRADERS",
  supplierHints: [],
  candidateSuppliers: [],
  debug: false,
};

function newConnectionError(): InstanceType<typeof OpenAI.APIConnectionError> {
  return new OpenAI.APIConnectionError({
    message: "Connection error.",
    cause: new Error("UND_ERR_SOCKET: other side closed"),
  });
}

// ---------------------------------------------------------------------------
// Invoice extraction
// ---------------------------------------------------------------------------

test("extractSupplierInvoice: primary success → no escalation, single call on primary model", async () => {
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    return successResponse(validInvoicePayload());
  });

  const provider = makeProvider({ client: stub });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "success");
  assert.deepEqual(calls, ["gpt-4o-mini"]);
  assert.equal(
    result.warnings.some(w => w.includes("escalated")),
    false,
    "no escalation warning on a primary-success path",
  );
});

test("extractSupplierInvoice: primary connection error → escalates to gpt-4o → success + warning", async () => {
  // This is the multipage 0-lines bug class end-to-end. Mini fails with a
  // socket error; provider catches it (status='failed', errorCode='connection')
  // and retries on gpt-4o; gpt-4o succeeds; result returned with the
  // escalation warning so the cost spike is visible.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    if (calls.length === 1) {
      // First (mini) attempt: throw connection error. SDK retries are
      // disabled on a stub client (we don't go through the real client's
      // retry loop), so we throw exactly once and the provider catches it.
      throw newConnectionError();
    }
    // Second (gpt-4o) attempt: succeed.
    return successResponse(validInvoicePayload());
  });

  const provider = makeProvider({ client: stub });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "success", "escalation produced a success result");
  assert.equal(result.errorCode, null);
  assert.deepEqual(
    calls,
    ["gpt-4o-mini", "gpt-4o"],
    "primary called once on mini, escalation called once on gpt-4o",
  );
  assert.equal(
    result.warnings.some(w => w.includes("escalated to 'gpt-4o'")),
    true,
    "escalation warning surfaced on the result",
  );
});

test("extractSupplierInvoice: primary AND escalation both fail → returns escalation's failure", async () => {
  // Both calls drop the socket — return parse_error with the escalation
  // attempt's error code (most recent signal). PipelineResult downstream
  // will see status='failed' and propagate as `parse_error`.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    throw newConnectionError();
  });

  const provider = makeProvider({ client: stub });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "connection");
  assert.deepEqual(calls, ["gpt-4o-mini", "gpt-4o"]);
});

test("extractSupplierInvoice: primary refusal → does NOT escalate", async () => {
  // Refusals are deterministic — escalating wastes tokens. Provider must
  // return the refusal without calling the escalation model.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    return {
      choices: [{ message: { parsed: null, refusal: "I cannot process this PDF." } }],
    };
  });

  const provider = makeProvider({ client: stub });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "refusal");
  assert.deepEqual(calls, ["gpt-4o-mini"], "no escalation call");
});

test("extractSupplierInvoice: primary already on gpt-4o → no escalation even on connection error", async () => {
  // When the user has overridden OPENAI_INVOICE_MODEL=gpt-4o, there's no
  // bigger model to escalate to. Provider must return the failure without
  // an infinite/duplicate retry.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    throw newConnectionError();
  });

  const provider = makeProvider({ client: stub, invoiceModel: "gpt-4o" });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "connection");
  assert.deepEqual(calls, ["gpt-4o"]);
});

test("extractSupplierInvoice: escalation disabled (empty model) → no escalation", async () => {
  // OPENAI_ESCALATION_MODEL="" is the cost-sensitive escape hatch.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    throw newConnectionError();
  });

  const provider = makeProvider({ client: stub, escalationModel: "" });
  const result = await provider.extractSupplierInvoice(SAMPLE_EXTRACTION_INPUT);

  assert.equal(result.status, "failed");
  assert.deepEqual(calls, ["gpt-4o-mini"]);
});

// ---------------------------------------------------------------------------
// Vision extraction
// ---------------------------------------------------------------------------

test("extractInvoiceFromPdf: primary connection error → escalates to gpt-4o → success + warning", async () => {
  // Same escalation pattern on the vision path. Vision calls are the more
  // expensive ones; this gate matters more cost-wise but the rules are
  // identical.
  const calls: string[] = [];
  const stub = makeStubClient(async ({ model }) => {
    calls.push(model);
    if (calls.length === 1) throw newConnectionError();
    return successResponse(validInvoicePayload());
  });

  const provider = makeProvider({ client: stub });
  const result = await provider.extractInvoiceFromPdf(SAMPLE_VISION_INPUT);

  assert.equal(result.status, "success");
  assert.deepEqual(calls, ["gpt-4o-mini", "gpt-4o"]);
  assert.equal(
    result.warnings.some(w => w.includes("escalated to 'gpt-4o'")),
    true,
  );
});
