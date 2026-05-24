import "server-only";

import pdfParse from "pdf-parse";
import { and, count, isNull, eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  parseSupplierInvoicePdfText,
  type SupplierInvoicePdfPrefillResult,
} from "../utils/pdf-prefill";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { extractPdfText, type PdfRow } from "./extract-pdf-text";
import {
  runParsingPipeline,
  scoreParseResult,
  type PipelineResult,
  type PipelineTelemetry,
} from "./parsing-pipeline";

export type { SupplierInvoicePdfPrefillResult };
export type { PipelineResult };

const MAX_PDF_PREFILL_BYTES = 25 * 1024 * 1024;

type ParseMode = PipelineTelemetry["mode"];
type TextExtractor = PipelineTelemetry["textExtractor"];

// `text-first` is the default: pdfjs-dist runs first (layout-preserving,
// more tolerant of synthetic / unusual XRef streams that trip pdf-parse),
// with pdf-parse as the fallback and vision after that. `PARSE_MODE=vision-only`
// reverts to the legacy pdf-parse → vision path for parity testing. The flag
// is read each call so it can be flipped at runtime without restarting.
function readParseMode(): ParseMode {
  const raw = (process.env.PARSE_MODE ?? "").toLowerCase().trim();
  return raw === "vision-only" ? "vision-only" : "text-first";
}

/**
 * An extractor we attempted that threw before we landed on the final
 * `textExtractor` value. Captured into the result so the parent can fire
 * a PostHog event per fallback hop — knowing how often pdf-parse falls
 * through to vision matters because vision is ~10x the cost.
 */
export type TextExtractorFallback = {
  extractor: TextExtractor;
  errorMessage: string;
};

// Extract invoice text under the active parse mode. The text-first branch
// uses pdfjs-dist to preserve table columns (line items become tab-separated
// rows) and falls back to pdf-parse if pdfjs throws or produces too few
// characters to be useful. Returns enough metadata for telemetry plus the
// raw text the rest of the pipeline expects.
async function extractTextForPipeline(
  bytes: Buffer,
  mode: ParseMode,
): Promise<{
  text: string;
  pageCount: number;
  textExtractor: TextExtractor;
  rows: PdfRow[];
  fallbacks: TextExtractorFallback[];
}> {
  const fallbacks: TextExtractorFallback[] = [];

  if (mode === "text-first") {
    try {
      // pdfjs-dist v5+ rejects Node's `Buffer` even though it extends
      // Uint8Array — copy into a plain Uint8Array view so the strict
      // instance check passes. Without this, every call falls through
      // to pdf-parse with "Please provide binary data as `Uint8Array`".
      const layout = await extractPdfText(
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      );
      if (layout.hasUsableText) {
        return {
          text: layout.combinedText,
          pageCount: layout.pageCount,
          textExtractor: "pdfjs-dist",
          rows: layout.rows,
          fallbacks,
        };
      }
    } catch (err) {
      // Swallow and fall through — pdfjs-dist occasionally chokes on PDFs
      // that pdf-parse handles fine; the downstream vision fallback covers
      // anything pdf-parse can't read either. One-line log: the full stack
      // is just noise here because the path is expected and the vision
      // branch picks up the slack.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[pdf-prefill] pdfjs-dist failed, falling back to pdf-parse (${msg})`,
      );
      fallbacks.push({ extractor: "pdfjs-dist", errorMessage: msg });
    }
  }
  // pdf-parse can throw on malformed content streams ("Invalid number ...
  // (charCode XX)" is the common one when it hits an unexpected token). When
  // it does, treat it the same as "produced no usable text" — return an
  // empty-text shell and let the downstream vision branch read the PDF
  // straight from its bytes. Without this catch a single failing PDF poisons
  // the whole bulk import.
  try {
    const parsed = await pdfParse(bytes);
    return {
      text: parsed.text?.trim() ?? "",
      pageCount: parsed.numpages ?? 1,
      textExtractor: "pdf-parse",
      // pdf-parse doesn't expose positions; without rows the bbox-matcher
      // downstream simply leaves UnresolvedLine.bbox unset and the highlight
      // overlay stays inactive for those parses.
      rows: [],
      fallbacks,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[pdf-prefill] pdf-parse failed, falling back to vision (${msg})`,
    );
    fallbacks.push({ extractor: "pdf-parse", errorMessage: msg });
    return {
      text: "",
      pageCount: 1,
      textExtractor: "pdf-parse",
      rows: [],
      fallbacks,
    };
  }
}

function isPdfFile(args: {
  originalFilename: string;
  mimeType: string | null;
}): boolean {
  const filenameLooksPdf = /\.pdf$/i.test(args.originalFilename.trim());
  const mimeLooksPdf = args.mimeType === "application/pdf";
  return filenameLooksPdf || mimeLooksPdf;
}

export async function parseSupplierInvoicePdf(input: {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
}): Promise<PipelineResult> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const originalFilename = input.originalFilename.trim();
  if (!originalFilename) {
    throw new Error("PDF file must have a name.");
  }
  if (!isPdfFile({ originalFilename, mimeType: input.mimeType })) {
    throw new Error("Upload a PDF invoice to prefill this bill.");
  }
  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new Error("Uploaded PDF is empty.");
  }
  if (input.bytes.byteLength > MAX_PDF_PREFILL_BYTES) {
    throw new Error(
      `PDF is too large. Maximum is ${MAX_PDF_PREFILL_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const mode = readParseMode();

  // Reserve a clean copy of the source bytes BEFORE the extractor touches
  // them. pdfjs-dist's getDocument({data}) detaches the underlying
  // ArrayBuffer when it forwards bytes to its parser; after that, the
  // original `input.bytes` Buffer still has the correct byteLength but
  // any read of its contents yields zeros. Downstream
  // runParsingPipeline -> hashPdfBytes -> SHA-256 then resolves to the
  // empty-input hash (e3b0c44298fc…) for EVERY parse in this Node
  // process, which collides every file in a bulk batch onto the same
  // ai_extraction_cache key — the first parse populates it, every
  // subsequent file in the batch hits it and returns the first file's
  // AI extraction. (#TODO follow-up: also harden the single-file action
  // paths in actions/index.ts that have the same shape.)
  const pipelineBytes = Buffer.from(input.bytes);

  const [extracted, [productCountRow]] = await Promise.all([
    extractTextForPipeline(input.bytes, mode),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.tenantId, tenant.id), isNull(products.archivedAt))),
  ]);

  // Report each extractor-fallback hop so the cost shape stays visible
  // in PostHog. pdf-parse → vision is the one to watch most closely —
  // vision is ~10x the cost per parse, so a regression here matters.
  for (const fallback of extracted.fallbacks) {
    void captureServerEvent({
      userId: currentUser.id,
      tenantId: tenant.id,
      event: "pdf.text_extractor_fallback",
      properties: {
        from_extractor: fallback.extractor,
        error_message: fallback.errorMessage,
        source_filename: originalFilename,
        parse_mode: mode,
      },
    });
  }

  const productCount = Number(productCountRow?.n ?? 0);

  const result = await runParsingPipeline({
    extractedText: extracted.text,
    extractedRows: extracted.rows,
    sourceFilename: originalFilename,
    tenantId: tenant.id,
    pdfPageCount: extracted.pageCount,
    pdfBytes: pipelineBytes,
    debug: process.env.NODE_ENV === "development",
    firstBillMode: productCount === 0,
  });

  return {
    ...result,
    telemetry: {
      mode,
      textExtractor: extracted.textExtractor,
      textCharCount: extracted.text.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Legacy entry point — returns the same shape as before for backward compat.
// Callers that haven't migrated to PipelineResult can use this.
// ---------------------------------------------------------------------------

export async function parseSupplierInvoicePdfLegacy(input: {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
}): Promise<SupplierInvoicePdfPrefillResult> {
  const result = await parseSupplierInvoicePdf(input);
  return result.prefillResult;
}

export { scoreParseResult, parseSupplierInvoicePdfText };
