"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AiExtractionErrorCode } from "../../services/ai-provider";

import type { BatchFile } from "./types";

/**
 * Click-through detail for a `parse-error` row in the Inbox tab.
 *
 * The Review button is disabled on these rows because there's nothing
 * meaningful to review — the AI extraction failed mid-stream and the
 * persisted result is the deterministic empty placeholder. This dialog
 * shows the user (a) what failed in human terms, (b) the underlying
 * AiExtractionErrorCode strings for screenshots / support, and (c) a
 * "Re-upload" button that opens the BulkImportSheet so they can drop the
 * same PDF in again. The server-side re-parse handler is still parked
 * (would skip the R2 re-upload and just re-run the pipeline against the
 * stored object) — tracked as a follow-up.
 *
 * Dismissing a failed row is handled separately by the existing X-on-hover
 * affordance in FileRow; this dialog intentionally doesn't dismiss the row
 * so the user has time to confirm the failure before clearing it.
 */

const PARSE_ERROR_DETAIL: Record<
  AiExtractionErrorCode,
  { title: string; body: string }
> = {
  connection: {
    title: "OpenAI couldn't be reached",
    body: "The connection to OpenAI dropped mid-stream while parsing this invoice. This is usually transient — re-uploading the PDF often succeeds on the next attempt.",
  },
  timeout: {
    title: "OpenAI request timed out",
    body: "OpenAI didn't respond in time. Long-completion calls (large invoices) are particularly affected. Re-upload to retry.",
  },
  rate_limit: {
    title: "Rate limit hit",
    body: "OpenAI throttled the request. Wait a minute, then re-upload the PDF to retry.",
  },
  refusal: {
    title: "AI refused this document",
    body: "OpenAI declined to parse this document. This usually means the content tripped a safety filter. Re-upload after editing the file, or record the bill manually.",
  },
  post_validation: {
    title: "AI response failed validation",
    body: "The AI returned a response that didn't match the expected schema. This is rare — re-upload to retry, or record the bill manually if it persists.",
  },
  no_output: {
    title: "AI produced no output",
    body: "The AI returned an empty response. Re-upload to retry, or record the bill manually.",
  },
  unknown: {
    title: "Unexpected AI error",
    body: "Something went wrong while parsing this invoice. Re-upload to retry, or record the bill manually.",
  },
};

export function ParseErrorDialog({
  file,
  parseErrorCodes,
  onOpenChange,
  onReupload,
}: {
  /** The row that triggered the dialog. `null` keeps the dialog closed. */
  file: BatchFile | null;
  /**
   * Coarse-grained failure classes from `bulk_import_files.parse_error_codes`
   * (typically `["connection"]` for the multipage bug class). May contain
   * duplicates when both text-AI and vision failed with the same code; the
   * primary message comes from the first entry.
   */
  parseErrorCodes: AiExtractionErrorCode[];
  onOpenChange: (open: boolean) => void;
  /** Opens the bulk-import sheet. The shell handles closing this dialog. */
  onReupload: () => void;
}) {
  const open = file !== null;
  const primaryCode = parseErrorCodes[0] ?? "unknown";
  const detail = PARSE_ERROR_DETAIL[primaryCode] ?? PARSE_ERROR_DETAIL.unknown;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div
            className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full"
            style={{ background: "oklch(94% 0.05 25)" }}
          >
            <AlertTriangle
              className="size-5"
              strokeWidth={1.8}
              style={{ color: "oklch(48% 0.18 25)" }}
            />
          </div>
          <DialogTitle className="text-center">{detail.title}</DialogTitle>
          <DialogDescription className="text-center">
            {file ? (
              <span className="mt-2 block font-mono text-[12px] text-stone-muted">
                {file.name}
              </span>
            ) : null}
            <span className="mt-3 block text-[13px] leading-[1.5] text-stone-muted">
              {detail.body}
            </span>
          </DialogDescription>
        </DialogHeader>

        {parseErrorCodes.length > 0 ? (
          <div className="rounded-md border border-stone-line bg-stone-line2 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
              Error codes
            </div>
            <div className="mt-1 font-mono text-[11px] text-stone-ink">
              {parseErrorCodes.join(" · ")}
            </div>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onReupload();
              onOpenChange(false);
            }}
            className="border-stone-ink bg-stone-ink text-stone-surface hover:bg-stone-ink/90"
          >
            Re-upload PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
