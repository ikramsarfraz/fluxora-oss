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

export type AiExtractionResult = {
  supplierName: string | null;
  supplierInvoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  fees: Array<{ description: string; amount: number }>;
  lines: AiInvoiceLine[];
  confidence: number;
  warnings: string[];
  reasoning: string;
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
      invoiceModel: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4o-mini",
      productMatchModel: process.env.OPENAI_PRODUCT_MATCH_MODEL ?? "gpt-4o-mini",
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
