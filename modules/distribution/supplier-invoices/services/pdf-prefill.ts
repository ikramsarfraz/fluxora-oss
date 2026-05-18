import "server-only";

import pdfParse from "pdf-parse";
import { and, count, isNull, eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
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

// PARSE_MODE=text-first activates the pdfjs-dist layout-preserving extractor
// before pdf-parse. Any other value (including unset) keeps the original
// pdf-parse → vision-fallback behaviour. The flag is read each call so it
// can be flipped at runtime without restarting the server.
function readParseMode(): ParseMode {
  const raw = (process.env.PARSE_MODE ?? "").toLowerCase().trim();
  return raw === "text-first" ? "text-first" : "vision-only";
}

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
}> {
  if (mode === "text-first") {
    try {
      const layout = await extractPdfText(bytes);
      if (layout.hasUsableText) {
        return {
          text: layout.combinedText,
          pageCount: layout.pageCount,
          textExtractor: "pdfjs-dist",
          rows: layout.rows,
        };
      }
    } catch (err) {
      // Swallow and fall through — pdfjs-dist occasionally chokes on PDFs
      // that pdf-parse handles fine; the downstream vision fallback covers
      // anything pdf-parse can't read either.
      console.warn("[pdf-prefill] pdfjs-dist extraction failed", err);
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
    };
  } catch (err) {
    console.warn("[pdf-prefill] pdf-parse extraction failed", err);
    return {
      text: "",
      pageCount: 1,
      textExtractor: "pdf-parse",
      rows: [],
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

  const [extracted, [productCountRow]] = await Promise.all([
    extractTextForPipeline(input.bytes, mode),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.tenantId, tenant.id), isNull(products.archivedAt))),
  ]);

  const productCount = Number(productCountRow?.n ?? 0);

  const result = await runParsingPipeline({
    extractedText: extracted.text,
    extractedRows: extracted.rows,
    sourceFilename: originalFilename,
    tenantId: tenant.id,
    pdfPageCount: extracted.pageCount,
    pdfBytes: input.bytes,
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
