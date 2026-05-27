"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import type {
  AIComposerProps,
  AiPasteChip,
} from "@/components/ai-composer/ai-composer";
import { usePageBodyPaste } from "@/components/ai-composer/ai-composer";
import {
  buildFillsLabel,
  extractOrderPreviewChips,
} from "@/lib/ai-paste-preview";
import { randomId } from "@/lib/random-id";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";

import { useParseSalesOrderText } from "../hooks/use-parse-order-text";
import type {
  NewOrderFormValues,
  NewOrderLineValues,
} from "./new-order-form.schema";

const SAMPLE_TEXT =
  "Hi, this is City Diner. Can we get 20 cases of ribeye and 5 cases of " +
  "chicken thigh, deliver Tuesday. Bill us at usual rates. Thanks!";

// Per-line hint kept in parent state so the lines table can show "AI
// suggested: <hint>" helper text on rows whose product picker is empty.
// Survives sort/reorder because the key is the line's stable random id.
export type LineParseHint = {
  lineKey: string;
  productHint: string;
  unit: string | null;
  weightLbs: number | null;
  confidence: number;
};

export type AiParseOrdersSummary = {
  warnings: string[];
  customerHint: string | null;
  autoFilledCustomerId: string | null;
  overallConfidence: number;
  customerCandidates: Array<{ id: string; name: string; confidence: number }>;
};

type UseAiParseOrdersArgs = {
  form: UseFormReturn<NewOrderFormValues>;
  /** Called after a successful parse — parent stashes per-line hints +
   *  summary so the form/lines table can render AI-suggestion chips. */
  onParsed: (args: {
    lineHints: LineParseHint[];
    summary: AiParseOrdersSummary;
  }) => void;
  /** Called when the user clicks "Undo" on the applied chip. Parent should
   *  clear its per-line hints + summary state. */
  onUndo?: () => void;
};

export type AiParseOrdersHandle = {
  /** Props to spread onto <PillOrChip> in the page header. */
  pillProps: {
    applied: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    summary?: string;
    onUndo?: () => void;
    onReopen?: () => void;
  };
  /** Props to spread onto <AIComposer> below the page header. */
  composerProps: AIComposerProps;
};

/**
 * Owns the open/text/applied state for the orders paste flow. Mount the
 * returned `pillProps` on `<PillOrChip>` in the page header, and
 * `composerProps` on `<AIComposer>` directly below the header. Parent
 * still owns the React Hook Form + per-line hint state.
 */
export function useAiParseOrders({
  form,
  onParsed,
  onUndo,
}: UseAiParseOrdersArgs): AiParseOrdersHandle {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [applied, setApplied] = useState<AiParseOrdersSummary | null>(null);
  // Snapshot of form values captured just before applying the parse. Lets
  // "Undo" restore the user's pre-AI work — including the case where they'd
  // already picked a customer or typed a delivery date.
  const snapshotRef = useRef<NewOrderFormValues | null>(null);

  const parse = useParseSalesOrderText();
  const { data: portalUser } = useCurrentPortalUser();

  // Deterministic preview chips — computed on every keystroke (cheap, no
  // network). Real parse only fires when the user clicks "Parse and fill".
  const chips: AiPasteChip[] = useMemo(
    () => (text ? extractOrderPreviewChips(text) : []),
    [text],
  );
  const fillsLabel = useMemo(() => buildFillsLabel(chips), [chips]);

  const handleApply = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    snapshotRef.current = form.getValues();
    try {
      const result = await parse.mutateAsync({ rawText: trimmed });
      if (result.status === "failed") {
        toast.error(result.errorMessage ?? "AI parse failed.");
        return;
      }

      const prefillLines: NewOrderLineValues[] = result.lines.map(line => ({
        key: randomId(),
        productId: "",
        salesUnitId: "",
        unitType: "catch_weight",
        inventoryItemIds: [],
        quantity: String(line.qty),
        pricePerLb: line.priceHint !== null ? String(line.priceHint) : "",
      }));

      form.reset({
        customerId: result.customer.suggestedId ?? "",
        orderDate: new Date().toISOString().slice(0, 10),
        deliveryDate: result.requestedDate ?? "",
        customerNotes: result.customerNotes ?? "",
        internalNotes: result.internalNotes ?? "",
        addFuelSurcharge: true,
        discountAmount: "",
        lines:
          prefillLines.length > 0
            ? prefillLines
            : [
                {
                  key: randomId(),
                  productId: "",
                  salesUnitId: "",
                  unitType: "catch_weight" as const,
                  inventoryItemIds: [],
                  quantity: "",
                  pricePerLb: "",
                },
              ],
      });

      const lineHints: LineParseHint[] = prefillLines.map((row, i) => ({
        lineKey: row.key,
        productHint: result.lines[i].productHint,
        unit: result.lines[i].unit,
        weightLbs: result.lines[i].weightLbs,
        confidence: result.lines[i].confidence,
      }));

      const summary: AiParseOrdersSummary = {
        warnings: result.warnings,
        customerHint: result.customer.hint,
        autoFilledCustomerId: result.customer.suggestedId,
        overallConfidence: result.confidence,
        customerCandidates: result.customer.candidates,
      };

      onParsed({ lineHints, summary });
      setApplied(summary);
      setOpen(false);

      toast.success(
        `Parsed ${result.lines.length} line${result.lines.length === 1 ? "" : "s"}. Review before saving.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed.";
      toast.error(message);
    }
  }, [form, onParsed, parse, text]);

  const handleUndo = useCallback(() => {
    if (snapshotRef.current) {
      form.reset(snapshotRef.current);
    }
    snapshotRef.current = null;
    setApplied(null);
    setText("");
    setOpen(false);
    onUndo?.();
  }, [form, onUndo]);

  const handleReopen = useCallback(() => {
    setOpen(true);
  }, []);

  // ⌘V anywhere on the page (not in an input) opens the drawer and seeds
  // the text. Disabled when the drawer is already open or applied — the
  // composer's own textarea handles paste natively in that state.
  usePageBodyPaste({
    enabled: !open && applied === null,
    onPaste: pastedText => {
      setText(pastedText);
      setOpen(true);
    },
  });

  const summary = useMemo(() => {
    if (!applied) return undefined;
    const customerLabel =
      applied.autoFilledCustomerId !== null
        ? (applied.customerHint ?? "customer")
        : "needs customer";
    const lineCount = form.getValues("lines")?.length ?? 0;
    return `${customerLabel} · ${lineCount} line${lineCount === 1 ? "" : "s"}`;
  }, [applied, form]);

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
        "Paste a customer message — WhatsApp, SMS, email, anything.",
      label: "Paste a customer message",
      sublabel:
        "We'll match the customer, line items, and delivery date. You confirm before saving.",
      chips: text.trim().length > 0 ? chips : null,
      fillsLabel,
      onApply: handleApply,
      isApplying: parse.isPending,
      consentTenantSlug: portalUser?.tenantId ?? undefined,
    },
  };
}
