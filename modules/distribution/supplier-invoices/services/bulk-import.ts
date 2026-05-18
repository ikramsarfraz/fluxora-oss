import "server-only";

import { captureException } from "@/lib/sentry-scope";

import { recordAiUsageEvents } from "./ai-usage-events";
import { createBulkImportFile } from "./bulk-import-history";
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

type ProcessOneFileArgs = {
  tenantId: string;
  uploadedByUserId: string;
  batchId: string;
};

async function processOneFile(
  file: BulkImportFileInput,
  args: ProcessOneFileArgs,
): Promise<BulkImportItemResult> {
  let pipeline: PipelineResult;
  try {
    pipeline = await parseSupplierInvoicePdf({
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
  } catch (err) {
    // The user-facing summary collapses this into "1 couldn't be read"
    // — Sentry needs the actual error to triage. Capture with the
    // filename + tenant context so we can group recurring failures by
    // supplier or PDF flavor.
    captureException(err, {
      stage: "parse_supplier_invoice_pdf",
      filename: file.originalFilename,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      tenant_id: args.tenantId,
      batch_id: args.batchId,
    });
    return {
      filename: file.originalFilename,
      status: "error",
      error: err instanceof Error ? err.message : "Failed to parse PDF.",
    };
  }

  const prefill = pipeline.prefillResult;
  const detectedSupplierName =
    prefill.unmatchedSupplierCandidates[0] ?? null;

  // Persist alongside parsing so the row is available to the bulk-landing
  // screen the moment the action returns. If R2 or DB fails we downgrade
  // the per-file result to "error" — a single bad row doesn't sink the
  // batch, and the original PipelineResult is already in hand so callers
  // can still proceed via the localStorage path until PR A2 lands.
  //
  // When the pipeline itself failed (AI connection drop etc.), the row goes
  // in with status='parse_error' instead of 'parsed'. Keep the PipelineResult
  // JSON so the user can still see what the deterministic stage produced; UI
  // surfaces a re-upload callout instead of a normal review card.
  const rowStatus: "parsed" | "parse_error" =
    pipeline.parseStatus === "parse_error" ? "parse_error" : "parsed";
  let bulkImportFileId: string;
  try {
    const created = await createBulkImportFile({
      tenantId: args.tenantId,
      uploadedByUserId: args.uploadedByUserId,
      batchId: args.batchId,
      filename: file.originalFilename,
      mimeType: file.mimeType,
      bytes: file.bytes,
      pipelineResult: pipeline,
      status: rowStatus,
      parseErrorCodes:
        rowStatus === "parse_error" ? pipeline.parseErrorCodes : undefined,
    });
    bulkImportFileId = created.id;
  } catch (err) {
    // Same rationale as the parse catch above — without explicit capture,
    // R2/DB persistence failures collapse into the same generic count
    // and we lose the underlying cause.
    captureException(err, {
      stage: "create_bulk_import_file",
      filename: file.originalFilename,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      tenant_id: args.tenantId,
      batch_id: args.batchId,
    });
    return {
      filename: file.originalFilename,
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
    tenantId: args.tenantId,
    portalUserId: args.uploadedByUserId,
    sourceBulkImportFileId: bulkImportFileId,
    sourceFilename: file.originalFilename,
    events: pipeline.usageEvents,
  });

  return {
    filename: file.originalFilename,
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
  const items: BulkImportItemResult[] = [];
  for (const file of files) {
    items.push(
      await processOneFile(file, {
        tenantId: args.tenantId,
        uploadedByUserId: args.uploadedByUserId,
        batchId,
      }),
    );
  }

  return { batchId, items, summary: summarize(items) };
}
