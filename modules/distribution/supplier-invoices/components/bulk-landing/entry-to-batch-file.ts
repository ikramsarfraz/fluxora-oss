/**
 * Convert a server-side `BulkImportFileRow` into the `BatchFile` the
 * bulk-landing screen renders against. The shape mirrors the prior
 * localStorage-backed entry conversion — the upstream change is purely
 * "where the row lives" (DB rather than localStorage), so the presentation
 * mapping stays stable.
 */

import type { BulkImportFileRow } from "../../services/bulk-import-history";
import type { AiExtractionErrorCode } from "../../services/ai-provider";

import type {
  BatchFile,
  BatchFileIssue,
  BatchFileStatus,
} from "./types";

/** User-facing message for each AI failure class. Keep short — fits the
 *  Issues column on the bulk-landing table. */
const PARSE_ERROR_LABEL: Record<AiExtractionErrorCode, string> = {
  connection: "OpenAI connection error — re-upload to retry",
  timeout: "OpenAI request timed out — re-upload to retry",
  rate_limit: "Rate limit hit — wait a moment, then re-upload",
  refusal: "AI refused this document — re-upload to retry",
  post_validation: "AI response failed validation — re-upload to retry",
  no_output: "AI produced no output — re-upload to retry",
  unknown: "Unexpected AI error — re-upload to retry",
};

function relativeTime(date: Date): string {
  const delta = Math.max(0, Date.now() - date.getTime());
  if (delta < 60 * 1000) return "just now";
  if (delta < 60 * 60 * 1000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 24 * 60 * 60 * 1000) return `${Math.floor(delta / (60 * 1000))}m ago`;
  if (delta < 7 * 24 * 60 * 60 * 1000)
    return `${Math.floor(delta / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(delta / (24 * 60 * 60 * 1000))}d ago`;
}

function unmatchedLineCount(row: BulkImportFileRow): number {
  const pipeline = row.pipelineResult;
  if (!pipeline) return 0;
  // Mirror the legacy localStorage stat: count lines whose unresolved entry
  // either has no suggested product or a low-confidence one. The pipeline
  // result already pre-computes this in `unresolvedLines` so we read it
  // straight off without re-deriving from `values.lines`.
  return pipeline.unresolvedLines.filter(
    u => !u.suggestedProductId || u.confidence < 65,
  ).length;
}

function lineCount(row: BulkImportFileRow): number {
  return row.pipelineResult?.prefillResult.values.lines.length ?? 0;
}

function supplierMatched(row: BulkImportFileRow): boolean {
  return Boolean(row.pipelineResult?.prefillResult.values.supplierId);
}

function supplierName(row: BulkImportFileRow): string | null {
  const pipeline = row.pipelineResult;
  if (!pipeline) return null;
  return pipeline.prefillResult.unmatchedSupplierCandidates[0] ?? null;
}

function warnings(row: BulkImportFileRow): string[] {
  return row.pipelineResult?.warnings ?? [];
}

function computedLineTotal(row: BulkImportFileRow): string {
  return (
    row.pipelineResult?.prefillResult.totalComparison.computedLineTotal ?? "0.00"
  );
}

function statusFor(row: BulkImportFileRow): BatchFileStatus {
  if (row.status === "reviewed") return "reviewed";
  // Hard parse failure: row is in the queue but the parse produced nothing
  // reviewable. UI surfaces a re-upload affordance instead of an editable form.
  if (row.status === "parse_error") return "parse-error";
  const unmatched = unmatchedLineCount(row);
  const matched = supplierMatched(row);
  const total = lineCount(row);
  if (unmatched === 0 && matched) return "attention";
  if (!matched || unmatched > total / 2) return "needs-review";
  return "attention";
}

function issuesFor(row: BulkImportFileRow): BatchFileIssue[] {
  // parse_error rows surface a single high-signal message from the AI
  // failure code instead of the usual per-line issues (which would all be
  // misleading — the form is empty by design, not because data was missing).
  if (row.status === "parse_error") {
    const codes = row.parseErrorCodes ?? [];
    if (codes.length === 0) {
      return [{ tone: "danger", message: PARSE_ERROR_LABEL.unknown }];
    }
    return [
      {
        tone: "danger",
        message: PARSE_ERROR_LABEL[codes[0]] ?? PARSE_ERROR_LABEL.unknown,
      },
    ];
  }

  const issues: BatchFileIssue[] = [];
  const matched = supplierMatched(row);
  const unmatched = unmatchedLineCount(row);
  const total = lineCount(row);
  const ws = warnings(row);

  if (!matched) {
    issues.push({ tone: "danger", message: "Supplier not in directory" });
  }
  if (unmatched > 0) {
    issues.push({
      tone: unmatched === total ? "danger" : "warn",
      message: `${unmatched} of ${total} lines unmatched`,
    });
  }
  if (ws.length > 0 && issues.length < 2) {
    issues.push({
      tone: "warn",
      message:
        ws.length === 1 ? ws[0] : `${ws.length} parsing warnings`,
    });
  }
  return issues;
}

export function rowToBatchFile(row: BulkImportFileRow): BatchFile {
  return {
    id: row.id,
    name: row.filename,
    supplier: supplierName(row),
    invoiceNumber:
      row.pipelineResult?.prefillResult.values.supplierInvoiceNumber || null,
    lineCount: lineCount(row),
    totalAmount: Number(computedLineTotal(row)) || 0,
    confidence: Math.round(row.pipelineResult?.confidence ?? 0),
    status: statusFor(row),
    issues: issuesFor(row),
    elapsedLabel: relativeTime(row.createdAt),
  };
}
