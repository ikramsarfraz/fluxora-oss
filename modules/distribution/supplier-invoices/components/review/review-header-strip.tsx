"use client";

import { FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ProgressIndicator } from "./progress-indicator";
import { REVIEW_COLORS } from "./tokens";
import type { ReviewCounts } from "./types";

export function ReviewHeaderStrip({
  fileName,
  counts,
  onReparse,
  onCancel,
  onSubmit,
  submitDisabled,
}: {
  fileName: string;
  counts: ReviewCounts;
  onReparse?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
}) {
  const blocked = counts.needsReview > 0 || submitDisabled === true;
  return (
    <div className="flex items-center justify-between gap-[18px] border-b border-border-default bg-page px-6 py-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-card py-[5px] pl-2 pr-2.5">
          <FileText
            className="size-4 shrink-0"
            strokeWidth={1.6}
            style={{ color: REVIEW_COLORS.danger }}
          />
          <span className="max-w-[300px] truncate font-mono text-[12px] font-medium text-ink">
            {fileName}
          </span>
        </div>
        <ProgressIndicator counts={counts} />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReparse}
          className="h-8 gap-1.5 text-[12px]"
        >
          <RefreshCw className="size-[12px]" strokeWidth={1.6} />
          Re-scan
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-8 text-[12px]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={blocked}
          onClick={onSubmit}
          className="h-8 border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest disabled:opacity-60"
        >
          {blocked ? `Resolve ${counts.needsReview} to continue` : "Complete & receive"}
        </Button>
      </div>
    </div>
  );
}
