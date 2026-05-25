import "server-only";

// ---------------------------------------------------------------------------
// AI Provider Abstraction for Supplier Invoice Extraction
//
// Provider selection via environment variables:
//
//   AI_PROVIDER=openai          Use OpenAI (requires OPENAI_API_KEY)
//   AI_PROVIDER=mock            Force mock provider (useful for testing)
//   (unset)                     Auto-detect: openai if OPENAI_API_KEY present,
//                               otherwise mock.
//
// OpenAI-specific env vars:
//   OPENAI_API_KEY              Required when using OpenAI provider.
//   OPENAI_INVOICE_MODEL        Model for invoice extraction (default: gpt-4o-mini)
//   OPENAI_PRODUCT_MATCH_MODEL  Model for product matching (default: gpt-4o-mini)
//   OPENAI_VISION_MODEL         Model for vision extraction (default: gpt-4o-mini)
//   OPENAI_ESCALATION_MODEL     Larger model used as a one-shot fallback when
//                               the primary call fails with a transient
//                               connection/timeout error (default: gpt-4o).
//                               Set to "" to disable escalation entirely.
//
// Cost controls:
//   AI_MAX_INVOICE_TEXT_CHARS   Max invoice text sent to AI (default: 30000)
//   AI_MAX_PRODUCT_CANDIDATES   Max products sent for matching (default: 75)
//
// Future providers (not yet implemented):
//   AI_PROVIDER=anthropic       Anthropic Claude
//   AI_PROVIDER=gemini          Google Gemini
//   AI_PROVIDER=local           OpenAI-compatible local endpoint (Ollama / vLLM)
// ---------------------------------------------------------------------------

export type AiInvoiceLine = {
  vendorProductName: string;
  /**
   * Optional secondary product description column on the invoice — usually the
   * spelled-out / human-readable version when the "Item" column carries an SKU
   * or short code (e.g. Item="RR Brisket Short Rib", Description="Brisket
   * Short Rib"). Kept separate from `vendorProductName` so the Review screen
   * can display it as additional context without polluting alias keys.
   * Optional (mirrors `caseWeights`) so older fixtures and the deterministic
   * path don't have to populate it; the validator backfills `null` for any
   * payload missing the key, so post-validation it always reads as
   * `string | null`.
   */
  vendorProductDescription?: string | null;
  quantityCases: number | null;
  quantityWeight: number | null;
  /**
   * Per-case weights when the invoice lists individual box/case weights
   * (e.g. "Box 1: 22.5 / Box 2: 23.1 / ..."). Length should equal
   * `quantityCases` when populated. Null/undefined when the invoice only
   * shows a combined weight or no weights at all.
   */
  caseWeights?: number[] | null;
  unitPrice: number | null;
  lineTotal: number | null;
  unitType: "catch_weight" | "fixed_case" | "per_each" | "per_unit" | null;
  /**
   * Unit-of-measure abbreviation (e.g. "ea", "cs", "gal"). Used by per_each
   * and per_unit lines; null/undefined for weight-priced modes. The
   * validator restricts this to a fixed allow-list (`AI_UNIT_OF_MEASURE_ALLOWLIST`).
   */
  unitOfMeasure?: string | null;
  // Pack size used to live here — moved to a regex pass on
  // `vendorProductDescription` (see `extractPackSizeFromDescription`).
  // The AI carries the pack phrase verbatim in the description and
  // the conversion step recovers the number deterministically.
  notes: string | null;
};

export type AiExtractionInput = {
  filename: string;
  extractedText: string;
  supplierHints: string[];
  candidateSuppliers: Array<{ id: string; name: string }>;
  candidateProducts: Array<{ id: string; name: string; sku: string | null }>;
};

/**
 * Per-call token usage and model info reported by the SDK. Surfaced from
 * every AI result so the action layer can record a cost-tracking row in
 * `ai_usage_events`. Null when the call failed before producing a usage
 * report (e.g. a connection error before the response arrived) or when the
 * provider is the mock.
 */
export type AiCallUsage = {
  /** The exact model the SDK was invoked with. */
  model: string;
  promptTokens: number;
  completionTokens: number;
  /**
   * When this call was an escalation retry, the model the primary attempt
   * used. Null on the primary attempt itself.
   */
  escalatedFromModel: string | null;
};

/**
 * Discriminates between "AI ran successfully (with whatever it found)" and
 * "AI failed before producing a usable result." This is the difference between
 * a non-invoice PDF (success, lines=[]) and a connection error mid-stream
 * (failed, lines=[]) — the downstream merge gate and queue UI need to treat
 * those very differently.
 */
export type AiExtractionErrorCode =
  | "connection"
  | "timeout"
  | "rate_limit"
  | "refusal"
  | "post_validation"
  | "no_output"
  | "unknown";

export type AiExtractionResult = {
  supplierName: string | null;
  supplierInvoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  fees: Array<{
    description: string;
    amount: number;
    /** Categorized by the AI for COGS reporting. Null when the model
     *  couldn't classify or for older results from before the taxonomy. */
    category?:
      | "fuel"
      | "freight"
      | "processing"
      | "inspection"
      | "cod"
      | "refrigeration"
      | "other"
      | null;
  }>;
  lines: AiInvoiceLine[];
  confidence: number;
  warnings: string[];
  reasoning: string;
  /**
   * Outcome discriminator. `success` means the AI call completed and produced
   * a parseable result (lines may still be empty if the document had none).
   * `failed` means the call threw, timed out, refused, or post-validation
   * rejected the response — never trust `lines`/`supplier*` fields on a
   * `failed` result.
   */
  status: "success" | "failed";
  /** Coarse-grained failure class for telemetry + retry decisions. Null on success. */
  errorCode: AiExtractionErrorCode | null;
  /** Verbatim error message from the SDK / validator. Null on success. */
  errorMessage: string | null;
  /**
   * Token usage + model identification for cost tracking. Null when the call
   * failed before the SDK delivered a usage report (e.g. connection error
   * mid-stream) or for the mock provider.
   */
  usage: AiCallUsage | null;
};

export type AiProductMatchInput = {
  tenantId: string;
  supplierId: string;
  vendorProductNames: string[];
  candidateProducts: Array<{ id: string; name: string; sku: string | null }>;
};

export type AiProductMatch = {
  vendorProductName: string;
  suggestedProductId: string | null;
  confidence: number;
  reasoning: string;
};

export type AiProductMatchResult = {
  matches: AiProductMatch[];
  /**
   * Outcome discriminator — same semantics as on `AiExtractionResult`. A
   * `failed` matching call means downstream consumers should fall back to
   * deterministic matches rather than trusting the empty `matches` array
   * as "the model considered all of these unresolvable."
   */
  status: "success" | "failed";
  errorCode: AiExtractionErrorCode | null;
  errorMessage: string | null;
  /** Token usage + model for cost tracking. Null when the call failed before
   *  usage info was available or for the mock provider. */
  usage: AiCallUsage | null;
};

// ---------------------------------------------------------------------------
// Vision extraction types — defined here so VisionProvider can extend AiProvider
// without introducing a circular import between ai-provider and ai-vision.
// ---------------------------------------------------------------------------

export type VisionExtractionInput = {
  pdfBuffer: Buffer;
  filename: string;
  extractedText?: string;
  supplierHints?: string[];
  candidateSuppliers?: Array<{ id: string; name: string }>;
  /**
   * Page count of the source PDF. Used by the vision service to short-
   * circuit before sending huge documents to OpenAI (token-limit / cost
   * blowup). Pass the count from upstream extraction when known.
   */
  pdfPageCount?: number;
  debug?: boolean;
};

export interface AiProvider {
  extractSupplierInvoice(input: AiExtractionInput): Promise<AiExtractionResult>;
  suggestProductMatches(input: AiProductMatchInput): Promise<AiProductMatchResult>;
  isAvailable(): boolean;
  /** Whether this provider can process raw PDF bytes via vision. */
  isVisionCapable(): boolean;
  /** Extract invoice data from a PDF buffer using vision. Returns rawJson for debug. */
  extractInvoiceFromPdf(
    input: VisionExtractionInput,
  ): Promise<AiExtractionResult & { rawJson: string }>;
}

// ---------------------------------------------------------------------------
// Mock provider — used in development/test when no AI key is configured.
// ---------------------------------------------------------------------------

class MockAiProvider implements AiProvider {
  isAvailable(): boolean {
    return false;
  }

  isVisionCapable(): boolean {
    return false;
  }

  async extractSupplierInvoice(_input: AiExtractionInput): Promise<AiExtractionResult> {
    return {
      supplierName: null,
      supplierInvoiceNumber: null,
      invoiceDate: null,
      totalAmount: null,
      subtotal: null,
      fees: [],
      lines: [],
      confidence: 0,
      warnings: [
        "AI extraction is not configured. Set AI_PROVIDER=openai and OPENAI_API_KEY to enable.",
      ],
      reasoning: "Mock provider — no AI extraction performed.",
      // Mock provider's "no output" is semantically a failure: the merge gate
      // should not apply any of these fields. status=failed makes that explicit.
      status: "failed",
      errorCode: "no_output",
      errorMessage: "AI provider not configured.",
      usage: null,
    };
  }

  async suggestProductMatches(input: AiProductMatchInput): Promise<AiProductMatchResult> {
    return {
      matches: input.vendorProductNames.map(name => ({
        vendorProductName: name,
        suggestedProductId: null,
        confidence: 0,
        reasoning: "Mock provider — no AI matching performed.",
      })),
      status: "failed",
      errorCode: "no_output",
      errorMessage: "AI provider not configured.",
      usage: null,
    };
  }

  async extractInvoiceFromPdf(
    _input: VisionExtractionInput,
  ): Promise<AiExtractionResult & { rawJson: string }> {
    return {
      supplierName: null,
      supplierInvoiceNumber: null,
      invoiceDate: null,
      totalAmount: null,
      subtotal: null,
      fees: [],
      lines: [],
      confidence: 0,
      warnings: [
        "Vision extraction is not available — no vision-capable AI provider is configured. Set AI_PROVIDER=openai and OPENAI_API_KEY to enable.",
      ],
      reasoning: "Mock provider — vision not available.",
      rawJson: "",
      status: "failed",
      errorCode: "no_output",
      errorMessage: "Vision-capable AI provider not configured.",
      usage: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _provider: AiProvider | null = null;

function resolveMaxInt(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function createAiProvider(): AiProvider {
  if (_provider !== null) return _provider;

  const providerType = (process.env.AI_PROVIDER ?? "").toLowerCase().trim();
  const openaiKey = process.env.OPENAI_API_KEY;

  const useOpenAi =
    providerType === "openai" || (providerType === "" && Boolean(openaiKey));

  if (useOpenAi) {
    if (!openaiKey) {
      // Fail loudly in production so misconfiguration is obvious.
      throw new Error(
        "OPENAI_API_KEY is required when AI_PROVIDER=openai. " +
          "Set it in .env.local or your deployment environment.",
      );
    }

    // Lazy import to avoid bundling OpenAI SDK when using other providers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAiProvider } = require("./ai-provider-openai") as typeof import("./ai-provider-openai");

    _provider = new OpenAiProvider({
      apiKey: openaiKey,
      // Defaults are `gpt-4o-mini` for both extraction stages: cheap (~$0.006
      // per parse vs. ~$0.10 on gpt-4o for a 100-line invoice) and fast for
      // typical invoice shapes (3-8 lines, <2K output tokens). The known
      // failure mode (`UND_ERR_SOCKET: other side closed` mid-stream on long
      // structured outputs) is handled by the escalation path: when the mini
      // call fails with a transient connection/timeout error, the provider
      // retries once with `escalationModel` (gpt-4o by default) before
      // declaring `parse_error`. See `OPENAI_ESCALATION_MODEL` env var.
      invoiceModel: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4o-mini",
      productMatchModel: process.env.OPENAI_PRODUCT_MATCH_MODEL ?? "gpt-4o-mini",
      visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
      // Escalation target. Set OPENAI_ESCALATION_MODEL="" to disable
      // escalation (useful for cost-sensitive environments that want hard
      // failures instead of paying for the bigger model on retry).
      escalationModel:
        process.env.OPENAI_ESCALATION_MODEL === undefined
          ? "gpt-4o"
          : process.env.OPENAI_ESCALATION_MODEL,
      maxInvoiceTextChars: resolveMaxInt(
        process.env.AI_MAX_INVOICE_TEXT_CHARS,
        30_000,
      ),
      maxProductCandidates: resolveMaxInt(
        process.env.AI_MAX_PRODUCT_CANDIDATES,
        75,
      ),
    });

    return _provider;
  }

  // TODO: add "anthropic", "gemini", "local" cases here as providers are implemented.

  _provider = new MockAiProvider();
  return _provider;
}

// ---------------------------------------------------------------------------
// Test helpers — call _setAiProviderForTest(null) to reset between tests.
// ---------------------------------------------------------------------------

export function _setAiProviderForTest(provider: AiProvider | null): void {
  _provider = provider;
}

export function _resetAiProvider(): void {
  _provider = null;
}
