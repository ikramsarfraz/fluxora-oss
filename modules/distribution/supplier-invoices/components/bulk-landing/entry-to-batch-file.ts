/**
 * Convert a localStorage handoff entry (the shape the bulk-import uploader
 * persists) into the `BatchFile` the new bulk-landing screen renders against.
 *
 * The mapping leans on:
 * - `pipelineResult.confidence` for the parse-confidence meter.
 * - `pipelineResult.unmatchedLineCount` + `warnings` for the issues column.
 * - The presence of `reviewedAt` for the StatusPill state.
 */

import type { StoredBulkImportEntry } from "../../utils/bulk-import-storage";

import type {
  BatchFile,
  BatchFileIssue,
  BatchFileStatus,
} from "./types";

const REL_TIME_UNITS: Array<[number, string]> = [
  [60 * 1000, "s"],
  [60 * 60 * 1000, "m"],
  [24 * 60 * 60 * 1000, "h"],
  [Infinity, "d"],
];

function relativeTime(ms: number): string {
  const delta = Math.max(0, Date.now() - ms);
  // Pick the largest unit that still produces a value <= 99, capped at "d".
  if (delta < REL_TIME_UNITS[0][0]) return "just now";
  if (delta < REL_TIME_UNITS[1][0]) {
    return `${Math.floor(delta / 1000)}s ago`;
  }
  if (delta < REL_TIME_UNITS[2][0]) {
    return `${Math.floor(delta / (60 * 1000))}m ago`;
  }
  if (delta < REL_TIME_UNITS[3][0]) {
    return `${Math.floor(delta / (60 * 60 * 1000))}h ago`;
  }
  return `${Math.floor(delta / (24 * 60 * 60 * 1000))}d ago`;
}

function statusFor(entry: StoredBulkImportEntry): BatchFileStatus {
  if (entry.reviewedAt) return "reviewed";
  const item = entry.item;
  const unmatched = item.unmatchedLineCount;
  const hasSupplier = item.supplierMatched;
  if (unmatched === 0 && hasSupplier) return "attention";
  if (!hasSupplier || unmatched > item.lineCount / 2) return "needs-review";
  return "attention";
}

function issuesFor(entry: StoredBulkImportEntry): BatchFileIssue[] {
  const item = entry.item;
  const issues: BatchFileIssue[] = [];
  if (!item.supplierMatched) {
    issues.push({ tone: "danger", message: "Supplier not in directory" });
  }
  if (item.unmatchedLineCount > 0) {
    issues.push({
      tone: item.unmatchedLineCount === item.lineCount ? "danger" : "warn",
      message: `${item.unmatchedLineCount} of ${item.lineCount} lines unmatched`,
    });
  }
  if (item.warnings.length > 0 && issues.length < 2) {
    issues.push({
      tone: "warn",
      message:
        item.warnings.length === 1
          ? item.warnings[0]
          : `${item.warnings.length} parsing warnings`,
    });
  }
  return issues;
}

export function entryToBatchFile(args: {
  key: string;
  entry: StoredBulkImportEntry;
}): BatchFile {
  const { key, entry } = args;
  const item = entry.item;
  return {
    id: key,
    name: item.filename,
    supplier: item.supplierName,
    invoiceNumber:
      item.pipelineResult.prefillResult.values.supplierInvoiceNumber || null,
    lineCount: item.lineCount,
    totalAmount: Number(item.computedLineTotal) || 0,
    confidence: Math.round(item.pipelineResult.confidence),
    status: statusFor(entry),
    issues: issuesFor(entry),
    elapsedLabel: relativeTime(entry.storedAt),
  };
}
