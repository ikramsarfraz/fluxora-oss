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
//   OPENAI_INVOICE_MODEL        Model for invoice extraction (default: gpt-4o)
//   OPENAI_PRODUCT_MATCH_MODEL  Model for product matching (default: gpt-4o-mini)
//   OPENAI_VISION_MODEL         Model for vision extraction (default: gpt-4o)
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
  unitType: "catch_weight" | "fixed_case" | null;
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
    const { OpenAiProvider } = require("./ai-provider-openai") as typeof import("./ai-provider-openai");

    _provider = new OpenAiProvider({
      apiKey: openaiKey,
      // Invoice extraction defaults to `gpt-4o`. We had `gpt-4o-mini` here
      // originally for cost, but the long structured outputs (~9K completion
      // tokens for a 100-line invoice) hit a `UND_ERR_SOCKET: other side
      // closed` failure pattern reliably under real-world load — confirmed
      // by user-observed `parse_error` rows + 10-minute retry waits.
      // gpt-4o has the throughput headroom; revisit at scale when telemetry
      // says the cost is worth optimising. Product-match calls stay on the
      // mini model because they're small structured outputs that haven't
      // shown the same failure mode.
      invoiceModel: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4o",
      productMatchModel: process.env.OPENAI_PRODUCT_MATCH_MODEL ?? "gpt-4o-mini",
      // Same reasoning — long structured outputs from a PDF need the bigger
      // model's throughput right now. Override via `OPENAI_VISION_MODEL` for
      // experimentation.
      visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
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
