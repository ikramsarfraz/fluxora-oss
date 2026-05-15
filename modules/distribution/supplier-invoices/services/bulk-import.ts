import "server-only";

import { parseSupplierInvoicePdf } from "./pdf-prefill";
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
      status: "error";
      error: string;
    };

export type BulkImportResult = {
  items: BulkImportItemResult[];
  summary: {
    total: number;
    parsed: number;
    errored: number;
  };
};

// Tunables — kept small for v1; bumping these only changes UI affordances.
export const BULK_IMPORT_MAX_FILES = 10;

function summarize(items: BulkImportItemResult[]): BulkImportResult["summary"] {
  return {
    total: items.length,
    parsed: items.filter(i => i.status === "parsed").length,
    errored: items.filter(i => i.status === "error").length,
  };
}

async function processOneFile(
  file: BulkImportFileInput,
): Promise<BulkImportItemResult> {
  let pipeline: PipelineResult;
  try {
    pipeline = await parseSupplierInvoicePdf({
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
  } catch (err) {
    return {
      filename: file.originalFilename,
      status: "error",
      error: err instanceof Error ? err.message : "Failed to parse PDF.",
    };
  }

  const prefill = pipeline.prefillResult;
  const detectedSupplierName =
    prefill.unmatchedSupplierCandidates[0] ?? null;

  return {
    filename: file.originalFilename,
    status: "parsed",
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
): Promise<BulkImportResult> {
  if (files.length === 0) {
    return { items: [], summary: summarize([]) };
  }
  if (files.length > BULK_IMPORT_MAX_FILES) {
    throw new Error(
      `At most ${BULK_IMPORT_MAX_FILES} PDFs can be imported in one batch.`,
    );
  }

  // Process serially. PDF parsing makes OpenAI calls (text + vision) which
  // are slow individually but parallel doesn't help much — the OpenAI rate
  // limits would kick in and we'd just end up queueing anyway. Serial keeps
  // the work bounded and the cost predictable.
  const items: BulkImportItemResult[] = [];
  for (const file of files) {
    items.push(await processOneFile(file));
  }

  return { items, summary: summarize(items) };
}
