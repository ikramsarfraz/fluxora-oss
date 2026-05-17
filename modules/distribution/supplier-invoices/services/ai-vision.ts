import "server-only";

import { createAiProvider } from "./ai-provider";
import type { VisionExtractionInput, AiExtractionResult } from "./ai-provider";

export type { VisionExtractionInput };

export type VisionExtractionResult = AiExtractionResult & {
  visionUsed: true;
  rawVisionJson: string;
};

// 20 MB — OpenAI file content practical limit for inline base64
const MAX_PDF_BYTES_FOR_VISION = 20 * 1024 * 1024;

function buildFailureResult(reason: string, rawContent = ""): VisionExtractionResult {
  return {
    supplierName: null,
    supplierInvoiceNumber: null,
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
    status: "failed",
    errorCode: "no_output",
    errorMessage: reason,
  };
}

export async function extractSupplierInvoiceWithVision(
  input: VisionExtractionInput,
): Promise<VisionExtractionResult> {
  if (input.pdfBuffer.byteLength > MAX_PDF_BYTES_FOR_VISION) {
    return buildFailureResult(
      `PDF exceeds maximum vision input size (${MAX_PDF_BYTES_FOR_VISION / (1024 * 1024)} MB).`,
    );
  }

  const provider = createAiProvider();
  if (!provider.isVisionCapable()) {
    return buildFailureResult(
      "Vision extraction is not available — no vision-capable provider configured. Set AI_PROVIDER=openai and OPENAI_API_KEY.",
    );
  }

  const result = await provider.extractInvoiceFromPdf(input);
  return { ...result, visionUsed: true, rawVisionJson: result.rawJson };
}
