import "server-only";

import { captureException } from "@/lib/sentry-scope";

import { recordAiUsageEvents } from "./ai-usage-events";
import {
  createBulkImportFile,
  findBulkImportFileByContentHash,
} from "./bulk-import-history";
import { extractPdfText } from "./extract-pdf-text";
import {
  parseSupplierInvoicePdf,
  parseSupplierInvoiceTextSegment,
} from "./pdf-prefill";
import { hashPdfBytes } from "../utils/pdf-content-hash";
import {
  detectInvoiceSegments,
  type InvoiceSegment,
} from "../utils/invoice-boundary-detector";
import type { PipelineResult } from "./parsing-pipeline";

// ---------------------------------------------------------------------------
// Bulk import — parse N supplier-invoice PDFs in one upload and return the
// parsed result for each, leaving the *create draft* decision to the human.
// Each file becomes a pending "needs review" item that the bulk-import panel
// hands off to the single-import flow (one new tab per item) so the user can
// confirm or correct extracted fields before any draft is written to the DB.
//
// Earlier versions of this service auto-created drafts when supplier and all
// products matched cleanly. That broke the "review every bill" expectation —
// silent drafts could be missed entirely — so the auto-create step has been
// removed.
// ---------------------------------------------------------------------------

export type BulkImportFileInput = {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
};

export type BulkImportItemResult =
  | {
      filename: string;
      status: "parsed";
      /**
       * Server-side bulk-import-file id (Phase A). Populated when the row was
       * created via the bulk-import action; optional for legacy client-side
       * re-parse paths (bulk-landing-live, parsing-progress-live) that
       * synthesise the result for the localStorage handoff. PR A2 will
       * retire those paths and make this field required.
       */
      bulkImportFileId?: string;
      /** Full pipeline result the client persists so the review form can be pre-filled. */
      pipelineResult: PipelineResult;
      /** Summary fields surfaced on the bulk results screen without unpacking pipelineResult. */
      supplierName: string | null;
      supplierMatched: boolean;
      lineCount: number;
      unmatchedLineCount: number;
      computedLineTotal: string;
      warnings: string[];
    }
  | {
      filename: string;
      status: "duplicate";
      /**
       * The existing (non-deleted) bulk-import row this upload matched
       * by SHA-256 (#222). The bulk-landing UI links to it via the
       * /supplier-invoices/bulk?file=... deep link so the reviewer can
       * open the original instead of re-importing.
       */
      linkedBulkImportFileId: string;
      /** Filename of the original row — useful when the re-upload was
       *  renamed and the user needs to recognise the prior import. */
      linkedFilename: string;
      /** When the original row was created — drives the "linked to
       *  existing parse from {date}" microcopy. */
      linkedCreatedAt: Date;
    }
  | {
      filename: string;
      status: "error";
      error: string;
    };

export type BulkImportResult = {
  /** Shared batch id stamped on every persisted row from this call. */
  batchId: string;
  items: BulkImportItemResult[];
  summary: {
    total: number;
    parsed: number;
    errored: number;
    /** Re-uploads of a PDF that's already on file for this tenant (#222).
     *  No new row is created and no R2 upload runs — the item links back
     *  to the original. */
    duplicate: number;
  };
};

// Tunables — kept small for v1; bumping these only changes UI affordances.
export const BULK_IMPORT_MAX_FILES = 10;

function summarize(items: BulkImportItemResult[]): BulkImportResult["summary"] {
  return {
    total: items.length,
    parsed: items.filter(i => i.status === "parsed").length,
    errored: items.filter(i => i.status === "error").length,
    duplicate: items.filter(i => i.status === "duplicate").length,
  };
}

type ProcessOneFileArgs = {
  tenantId: string;
  uploadedByUserId: string;
  batchId: string;
};

async function processOneFile(
  file: BulkImportFileInput,
  args: ProcessOneFileArgs,
): Promise<BulkImportItemResult[]> {
  // Defensive copy of the source bytes BEFORE the parse pipeline touches
  // them. The pipeline streams the buffer to OpenAI / pdf-parse, and under
  // Node 22+ undici can detach the underlying ArrayBuffer when forwarding
  // a Buffer body for zero-copy transfer. After detach, the original
  // `file.bytes` view is unusable — the subsequent createBulkImportFile
  // R2 upload fails with "Cannot perform Construct on a detached
  // ArrayBuffer". Holding our own copy here keeps persistence independent
  // of whatever the pipeline does to its argument.
  const persistBytes = Buffer.from(file.bytes);

  // Dedup at upload (#222). Hash the bytes once up-front and look for an
  // existing live row with the same content for this tenant. When found,
  // short-circuit BEFORE the parse pipeline + R2 upload — the original
  // row already has its pipelineResult cached and the user is better
  // served by being routed back to it than by an identical second copy
  // appearing in the queue. The hash threads down through both the
  // single- and multi-invoice paths so each persisted row carries it for
  // future dedup checks.
  const pdfContentHash = hashPdfBytes(persistBytes);
  const existing = await findBulkImportFileByContentHash({
    tenantId: args.tenantId,
    pdfContentHash,
  });
  if (existing) {
    return [
      {
        filename: file.originalFilename,
        status: "duplicate",
        linkedBulkImportFileId: existing.id,
        linkedFilename: existing.filename,
        linkedCreatedAt: existing.createdAt,
      },
    ];
  }

  // Boundary detection (#224). Extract text up-front so we can decide
  // whether this PDF carries one invoice or several. The single-invoice
  // path (the common case) still calls the full `parseSupplierInvoicePdf`
  // with the original bytes so vision stays enabled — splitting kicks in
  // only when the detector finds 2+ distinct invoice numbers.
  let segments: InvoiceSegment[] | null = null;
  try {
    const detection = await extractPdfText(
      new Uint8Array(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength),
    );
    if (detection.hasUsableText) {
      const candidate = detectInvoiceSegments(detection.combinedText);
      if (candidate.length > 1) segments = candidate;
    }
  } catch (err) {
    // Detection is best-effort — a pdfjs-dist failure here mustn't sink
    // the upload. We just fall through to the single-invoice path,
    // which has its own pdf-parse fallback chain inside the pipeline.
    captureException(err, {
      stage: "detect_invoice_segments",
      filename: file.originalFilename,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      tenant_id: args.tenantId,
      batch_id: args.batchId,
    });
  }

  if (segments && segments.length > 1) {
    return processMultiInvoiceFile(file, persistBytes, pdfContentHash, segments, args);
  }

  // Single-invoice happy path — identical to pre-#224 behaviour. Returns
  // a one-element array so the caller can flatten without branching.
  return processSingleInvoiceFile(file, persistBytes, pdfContentHash, args);
}

async function processSingleInvoiceFile(
  file: BulkImportFileInput,
  persistBytes: Buffer,
  pdfContentHash: string,
  args: ProcessOneFileArgs,
): Promise<BulkImportItemResult[]> {
  let pipeline: PipelineResult;
  try {
    pipeline = await parseSupplierInvoicePdf({
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
  } catch (err) {
    captureException(err, {
      stage: "parse_supplier_invoice_pdf",
      filename: file.originalFilename,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      tenant_id: args.tenantId,
      batch_id: args.batchId,
    });
    return [
      {
        filename: file.originalFilename,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to parse PDF.",
      },
    ];
  }

  return [
    await persistAndSummarize({
      file,
      filename: file.originalFilename,
      persistBytes,
      pdfContentHash,
      pipeline,
      args,
    }),
  ];
}

/**
 * Multi-invoice path (#224): one input file → N parse passes, one
 * `bulk_import_files` row per detected segment. All rows share the
 * `batchId` so the review queue carousel groups them naturally. Each
 * segment's R2 object stores the FULL source PDF bytes — the reviewer
 * still needs to look at the whole document when verifying a line they
 * suspect spans pages. PDF-byte slicing is a follow-up.
 */
async function processMultiInvoiceFile(
  file: BulkImportFileInput,
  persistBytes: Buffer,
  pdfContentHash: string,
  segments: InvoiceSegment[],
  args: ProcessOneFileArgs,
): Promise<BulkImportItemResult[]> {
  const results: BulkImportItemResult[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Suffix the filename so the user can distinguish each segment in
    // the review queue. We deliberately keep the suffix simple: the
    // detected invoice number when we have one, plus a "(k/N)"
    // breadcrumb so the user knows where this card sits in the bundle.
    const breadcrumb = `(${i + 1}/${segments.length})`;
    const segmentLabel = segment.detectedInvoiceNumber
      ? `${file.originalFilename} — Invoice ${segment.detectedInvoiceNumber} ${breadcrumb}`
      : `${file.originalFilename} — pages ${segment.startPage}-${segment.endPage} ${breadcrumb}`;

    let pipeline: PipelineResult;
    try {
      pipeline = await parseSupplierInvoiceTextSegment({
        originalFilename: file.originalFilename,
        segmentText: segment.text,
        pageCount: segment.endPage - segment.startPage + 1,
        textExtractor: "pdfjs-dist",
        parseMode: "text-first",
      });
    } catch (err) {
      captureException(err, {
        stage: "parse_supplier_invoice_segment",
        filename: file.originalFilename,
        segment_index: i,
        segment_count: segments.length,
        mime_type: file.mimeType,
        size_bytes: file.bytes.byteLength,
        tenant_id: args.tenantId,
        batch_id: args.batchId,
      });
      results.push({
        filename: segmentLabel,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to parse segment.",
      });
      continue;
    }

    results.push(
      await persistAndSummarize({
        file,
        filename: segmentLabel,
        persistBytes,
        pdfContentHash,
        pipeline,
        args,
      }),
    );
  }
  return results;
}

/**
 * Write the R2 object + DB row for one parse outcome and shape the
 * `BulkImportItemResult`. Lifted out of the per-path functions because
 * single-invoice and multi-invoice paths persist identically — only
 * the parse step differs.
 */
async function persistAndSummarize(args: {
  file: BulkImportFileInput;
  /** Display filename for this row (the source filename for the single-
   *  invoice path; the segment-suffixed label for the multi-invoice path). */
  filename: string;
  persistBytes: Buffer;
  pdfContentHash: string;
  pipeline: PipelineResult;
  args: ProcessOneFileArgs;
}): Promise<BulkImportItemResult> {
  const { file, filename, persistBytes, pdfContentHash, pipeline } = args;
  const prefill = pipeline.prefillResult;
  const detectedSupplierName =
    prefill.unmatchedSupplierCandidates[0] ?? null;

  const rowStatus: "parsed" | "parse_error" =
    pipeline.parseStatus === "parse_error" ? "parse_error" : "parsed";
  let bulkImportFileId: string;
  try {
    const created = await createBulkImportFile({
      tenantId: args.args.tenantId,
      uploadedByUserId: args.args.uploadedByUserId,
      batchId: args.args.batchId,
      filename,
      mimeType: file.mimeType,
      bytes: persistBytes,
      pipelineResult: pipeline,
      status: rowStatus,
      parseErrorCodes:
        rowStatus === "parse_error" ? pipeline.parseErrorCodes : undefined,
      pdfContentHash,
    });
    bulkImportFileId = created.id;
  } catch (err) {
    captureException(err, {
      stage: "create_bulk_import_file",
      filename,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      tenant_id: args.args.tenantId,
      batch_id: args.args.batchId,
    });
    return {
      filename,
      status: "error",
      error:
        err instanceof Error
          ? `Persistence failed: ${err.message}`
          : "Failed to persist PDF.",
    };
  }

  // Best-effort cost tracking. Records one row per OpenAI call this parse
  // made. Failure here doesn't fail the parse — the user's review flow is
  // unaffected, we just lose a row of telemetry.
  await recordAiUsageEvents({
    tenantId: args.args.tenantId,
    portalUserId: args.args.uploadedByUserId,
    sourceBulkImportFileId: bulkImportFileId,
    sourceFilename: filename,
    events: pipeline.usageEvents,
  });

  return {
    filename,
    status: "parsed",
    bulkImportFileId,
    pipelineResult: pipeline,
    supplierName: detectedSupplierName,
    supplierMatched: Boolean(prefill.values.supplierId),
    lineCount: prefill.values.lines.length,
    unmatchedLineCount: prefill.values.lines.filter(l => !l.productId).length,
    computedLineTotal: prefill.totalComparison.computedLineTotal ?? "0.00",
    warnings: pipeline.warnings,
  };
}

export async function bulkImportSupplierInvoices(
  files: BulkImportFileInput[],
  args: { tenantId: string; uploadedByUserId: string },
): Promise<BulkImportResult> {
  const batchId = crypto.randomUUID();
  if (files.length === 0) {
    return { batchId, items: [], summary: summarize([]) };
  }
  if (files.length > BULK_IMPORT_MAX_FILES) {
    throw new Error(
      `At most ${BULK_IMPORT_MAX_FILES} PDFs can be imported in one batch.`,
    );
  }

  // Process serially. PDF parsing makes OpenAI text calls which are slow
  // individually but parallel doesn't help much — the OpenAI rate limits
  // would kick in and we'd just end up queueing anyway. Serial keeps the
  // work bounded and the cost predictable.
  //
  // `processOneFile` returns an array because a bundle PDF (#224) fans
  // out to N rows. Flatten so the per-file outcomes still surface
  // one-result-per-row to the dropzone client.
  const items: BulkImportItemResult[] = [];
  for (const file of files) {
    const fileResults = await processOneFile(file, {
      tenantId: args.tenantId,
      uploadedByUserId: args.uploadedByUserId,
      batchId,
    });
    items.push(...fileResults);
  }

  return { batchId, items, summary: summarize(items) };
}
