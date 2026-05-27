"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AIComposerProps,
  AiPasteChip,
} from "@/components/ai-composer/ai-composer";
import { usePageBodyPaste } from "@/components/ai-composer/ai-composer";
import {
  buildFillsLabel,
  extractBillPreviewChips,
} from "@/lib/ai-paste-preview";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";

import { useParseBillText } from "../hooks/use-parse-bill-text";
import type { PipelineResult } from "../services/parsing-pipeline";

const SAMPLE_TEXT =
  "Summit Trading — Invoice #57876, 4/20/26. 4 cases chicken tender " +
  "@ $1.00/lb, 80 lbs. Freight $45.";

type UseAiParseBillsArgs = {
  /** Container's seedFromPipelineResult — same code path the PDF upload uses. */
  onParsed: (result: PipelineResult) => void;
  /** Called when the user clicks "Undo" on the applied chip. Parent should
   *  clear its form state (or the parent doesn't expose seedFromPipelineResult
   *  in reverse — undo currently triggers a full page-state reset upstream). */
  onUndo?: () => void;
};

export type AiParseBillsHandle = {
  pillProps: {
    applied: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    summary?: string;
    onUndo?: () => void;
    onReopen?: () => void;
  };
  composerProps: AIComposerProps;
};

/**
 * Owns open/text/applied state for the bills paste flow. Same shape as
 * `useAiParseOrders` — parent mounts `pillProps` in the page header and
 * `composerProps` below it.
 */
export function useAiParseBills({
  onParsed,
  onUndo,
}: UseAiParseBillsArgs): AiParseBillsHandle {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [applied, setApplied] = useState<{
    supplierName: string | null;
    lineCount: number;
    chargeCount: number;
  } | null>(null);
  // Holds the parsed PipelineResult so "View source" can reopen the
  // drawer with the original text restored.
  const lastResultRef = useRef<PipelineResult | null>(null);

  const parse = useParseBillText();
  const { data: portalUser } = useCurrentPortalUser();

  const chips: AiPasteChip[] = useMemo(
    () => (text ? extractBillPreviewChips(text) : []),
    [text],
  );
  const fillsLabel = useMemo(() => buildFillsLabel(chips), [chips]);

  const handleApply = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const result = await parse.mutateAsync({ rawText: trimmed });
      onParsed(result);
      lastResultRef.current = result;
      // For the chip summary we just want a human-facing supplier name.
      // When the matcher resolved a supplier, the parsed candidate is the
      // most-readable label (the pipeline records what the bill said, not
      // the catalog's canonical name). Falls back to the first unmatched
      // candidate when no match — same string the supplier picker would
      // surface as a "Read from bill:" hint.
      setApplied({
        supplierName:
          result.prefillResult.unmatchedSupplierCandidates[0] ??
          (result.prefillResult.values.supplierId ? "supplier" : null),
        lineCount: result.prefillResult.values.lines.length,
        chargeCount: result.detectedFees.length,
      });
      setOpen(false);
      const lineCount = result.prefillResult.values.lines.length;
      toast.success(
        `Parsed ${lineCount} line${lineCount === 1 ? "" : "s"}. Review every field before saving the draft.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed.";
      toast.error(message);
    }
  }, [onParsed, parse, text]);

  const handleUndo = useCallback(() => {
    setApplied(null);
    setText("");
    lastResultRef.current = null;
    setOpen(false);
    onUndo?.();
  }, [onUndo]);

  const handleReopen = useCallback(() => {
    setOpen(true);
  }, []);

  usePageBodyPaste({
    enabled: !open && applied === null,
    onPaste: pastedText => {
      setText(pastedText);
      setOpen(true);
    },
  });

  const summary = useMemo(() => {
    if (!applied) return undefined;
    const parts: string[] = [];
    if (applied.supplierName) parts.push(applied.supplierName);
    parts.push(`${applied.lineCount} line${applied.lineCount === 1 ? "" : "s"}`);
    if (applied.chargeCount > 0) {
      parts.push(`${applied.chargeCount} charge${applied.chargeCount === 1 ? "" : "s"}`);
    }
    return parts.join(" · ");
  }, [applied]);

  return {
    pillProps: {
      applied: applied !== null,
      open,
      onOpenChange: setOpen,
      summary,
      onUndo: applied !== null ? handleUndo : undefined,
      onReopen: applied !== null ? handleReopen : undefined,
    },
    composerProps: {
      open,
      onOpenChange: setOpen,
      text,
      onTextChange: setText,
      sample: SAMPLE_TEXT,
      placeholder:
        "Paste the supplier's bill — email body, text message, or typed summary. " +
        "PDFs use Scan PDF above.",
      label: "Paste a supplier bill",
      sublabel:
        "Supplier, invoice number, dates, line items, and non-inventory charges will be matched.",
      chips: text.trim().length > 0 ? chips : null,
      fillsLabel,
      onApply: handleApply,
      isApplying: parse.isPending,
      consentTenantSlug: portalUser?.tenantId ?? undefined,
    },
  };
}
