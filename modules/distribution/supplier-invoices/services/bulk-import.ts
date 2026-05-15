import "server-only";

import { parseSupplierInvoicePdf } from "./pdf-prefill";
import {
  createSupplierInvoice,
  type SupplierInvoiceLineInput,
} from "./receiving";
import { computeDraftLineWeight } from "../utils/case-weights";

// ---------------------------------------------------------------------------
// Bulk import — accept N supplier-invoice PDFs in one upload, run each
// through the existing parse pipeline, and auto-create a draft invoice for
// every file we can safely match end-to-end. Anything ambiguous (no
// supplier match, unmatched products, parse failure) is returned to the
// caller as a "needs_review" or "error" entry so they can be resolved
// individually via the single-import flow.
// ---------------------------------------------------------------------------

export type BulkImportFileInput = {
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
};

export type BulkImportItemResult =
  | {
      filename: string;
      status: "created";
      invoiceId: string;
      supplierName: string | null;
      lineCount: number;
      totalAmount: string;
      warnings: string[];
    }
  | {
      filename: string;
      status: "needs_review";
      reason: string;
      detectedSupplierName?: string | null;
      lineCount?: number;
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
    created: number;
    needsReview: number;
    errored: number;
  };
};

// Tunables — kept small for v1; bumping these only changes UI affordances.
export const BULK_IMPORT_MAX_FILES = 10;

function summarize(items: BulkImportItemResult[]): BulkImportResult["summary"] {
  return {
    total: items.length,
    created: items.filter(i => i.status === "created").length,
    needsReview: items.filter(i => i.status === "needs_review").length,
    errored: items.filter(i => i.status === "error").length,
  };
}

/**
 * Process a single file through the parse pipeline and either create a draft
 * invoice or surface the reason it can't be auto-created. Run inside the
 * tenant + permission scope already established by the calling action.
 */
async function processOneFile(
  file: BulkImportFileInput,
): Promise<BulkImportItemResult> {
  let pipeline;
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

  // First-bill mode means the catalog is empty — there's nothing to match
  // products against, so every line needs human attention. We can't usefully
  // auto-create a draft here; the user should run each through the
  // single-import flow to seed products.
  if (pipeline.firstBillLines !== undefined) {
    return {
      filename: file.originalFilename,
      status: "needs_review",
      reason:
        "Catalog is empty — import this PDF individually so each line can be mapped to a new product.",
      detectedSupplierName,
      lineCount: prefill.values.lines.length,
    };
  }

  if (pipeline.requiresOcr) {
    return {
      filename: file.originalFilename,
      status: "needs_review",
      reason:
        "PDF appears to be a scanned image — no readable text. Re-import individually so it can be reviewed.",
    };
  }

  if (!prefill.values.supplierId) {
    return {
      filename: file.originalFilename,
      status: "needs_review",
      reason: detectedSupplierName
        ? `Supplier "${detectedSupplierName}" wasn't matched — pick it manually in single-import.`
        : "Supplier couldn't be matched — pick it manually in single-import.",
      detectedSupplierName,
      lineCount: prefill.values.lines.length,
    };
  }

  if (prefill.values.lines.length === 0) {
    return {
      filename: file.originalFilename,
      status: "needs_review",
      reason: "No line items could be read from this PDF.",
      detectedSupplierName,
    };
  }

  const unmatched = prefill.values.lines.filter(l => !l.productId).length;
  if (unmatched > 0) {
    return {
      filename: file.originalFilename,
      status: "needs_review",
      reason: `${unmatched} of ${prefill.values.lines.length} line${prefill.values.lines.length === 1 ? "" : "s"} couldn't be matched to a catalog product — resolve in single-import.`,
      detectedSupplierName,
      lineCount: prefill.values.lines.length,
    };
  }

  // All gates passed — create the draft invoice.
  const lineInputs: SupplierInvoiceLineInput[] = prefill.values.lines.map(line => ({
    productId: line.productId,
    quantityCases: Number.parseInt(line.quantityCases, 10) || 1,
    weightLbs:
      line.unitType === "catch_weight"
        ? computeDraftLineWeight(line).toFixed(4)
        : line.weightLbs || "0",
    unitType: line.unitType,
    unitPrice: line.unitPrice || "0",
    caseWeightsLbs: null,
  }));

  try {
    const created = await createSupplierInvoice({
      supplierId: prefill.values.supplierId,
      invoiceNumber: prefill.values.invoiceNumber || `BILL-${Date.now()}`,
      invoiceDate: prefill.values.invoiceDate,
      receiveDate: prefill.values.receiveDate || prefill.values.invoiceDate,
      paymentMethod: prefill.values.paymentMethod,
      notes: prefill.values.notes || null,
      lines: lineInputs,
      complete: false,
    });

    return {
      filename: file.originalFilename,
      status: "created",
      invoiceId: created.id,
      supplierName: detectedSupplierName,
      lineCount: lineInputs.length,
      totalAmount: created.totalAmount ?? "0.00",
      // Pipeline warnings worth surfacing on the summary screen so the user
      // knows what to double-check on the freshly-created draft.
      warnings: pipeline.warnings,
    };
  } catch (err) {
    return {
      filename: file.originalFilename,
      status: "error",
      error:
        err instanceof Error
          ? err.message
          : "Failed to save draft invoice.",
    };
  }
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
