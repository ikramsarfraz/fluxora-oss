"use client";

import { ArrowUp, Sparkles, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public types — exported so the deterministic preview-chip extractor and
// the consuming forms can share the same shape.
// ---------------------------------------------------------------------------

export type AiPasteConfidence = "good" | "mid" | "low";

export type AiPasteChip = {
  /** The matched span verbatim from the user's text (e.g. "City Diner",
   *  "20 cs ribeye"). Bolded inside the chip. */
  label: string;
  /** What the matched span maps to in the form ("Customer", "Line 1", etc.).
   *  Rendered after a "→" pseudo-element. */
  field: string;
  /** 0–100. Drives the chip's color band — see `confidenceBand`. */
  conf: number;
};

export function confidenceBand(conf: number): AiPasteConfidence {
  if (conf >= 85) return "good";
  if (conf >= 70) return "mid";
  return "low";
}

// ---------------------------------------------------------------------------
// PillOrChip — the header surface. Idle = pill; after parse = applied chip
// with Undo + View source. Parent owns the boolean.
// ---------------------------------------------------------------------------

type PillOrChipProps = {
  applied: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown only on the applied chip ("City Diner · 2 lines"). */
  summary?: string;
  /** Discards prefill + restores the snapshot. Required when `applied`. */
  onUndo?: () => void;
  /** Reopens the drawer with the original text intact. Required when `applied`. */
  onReopen?: () => void;
};

export function PillOrChip({
  applied,
  open,
  onOpenChange,
  summary,
  onUndo,
  onReopen,
}: PillOrChipProps) {
  if (applied) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-[12.5px] text-success-fg">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-success-fg"
        />
        <span>
          <strong className="font-medium">AI prefilled</strong>
          {summary ? <> · {summary}</> : null}
        </span>
        {onUndo ? (
          <>
            <button
              type="button"
              onClick={onUndo}
              className="font-medium underline-offset-2 hover:underline"
            >
              Undo
            </button>
            <span aria-hidden className="text-success-fg/60">
              ·
            </span>
          </>
        ) : null}
        {onReopen ? (
          <button
            type="button"
            onClick={onReopen}
            className="font-medium underline-offset-2 hover:underline"
          >
            View source
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        open
          ? "bg-forest text-card-warm border border-forest"
          : "bg-card border border-forest-tint-deep text-forest hover:bg-forest-tint hover:border-forest",
      )}
    >
      <Sparkles className="size-[13px] stroke-[1.5]" aria-hidden />
      <span>Paste from message</span>
      <kbd
        className={cn(
          "rounded border px-[5px] py-[1px] font-mono text-[10.5px]",
          open
            ? "border-card-warm/30 bg-forest-mid text-card-warm/80"
            : "border-border bg-surface text-subtle",
        )}
      >
        ⌘V
      </kbd>
    </button>
  );
}

// ---------------------------------------------------------------------------
// PreviewChip — confidence-banded chip inside the live preview strip.
// ---------------------------------------------------------------------------

function PreviewChip({ chip }: { chip: AiPasteChip }) {
  const band = confidenceBand(chip.conf);
  const colors =
    band === "good"
      ? "bg-success-bg border-success-border [&_.dot]:bg-success-fg"
      : band === "mid"
        ? "bg-warning-bg border-warning-border [&_.dot]:bg-warning-fg"
        : "bg-danger-bg border-danger-border [&_.dot]:bg-danger-fg";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[4px] text-[11.5px]",
        colors,
      )}
    >
      <span aria-hidden className="dot size-1.5 rounded-full" />
      <span className="font-medium text-ink">{chip.label}</span>
      <span className="text-[11px] text-subtle before:content-['→_']">
        {chip.field}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AIComposer — the drawer body. Renders a textarea + send button, then a
// live preview chip strip once text is present, then a footer with Clear +
// "Parse and fill". Parent controls the drawer's collapsed/expanded state
// via `open`; this component only animates its own max-height.
// ---------------------------------------------------------------------------

export type AIComposerHandle = {
  focus: () => void;
};

export type AIComposerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onTextChange: (text: string) => void;

  /**
   * Tenant slug used to scope the one-time AI-consent notice. The notice
   * surfaces above the composer body the first time the user opens the
   * drawer for this tenant; dismissal is remembered in localStorage under
   * `fluxora.ai.consent.<tenantSlug>`. Omit to disable the consent surface
   * (e.g. for tenants that have already acknowledged at the org level, or
   * for non-tenant-scoped consumers).
   */
  consentTenantSlug?: string;

  /** Pre-fills the textarea when the user clicks "Try sample". */
  sample: string;
  placeholder: string;
  /** Drawer title (e.g. "Paste a customer message"). */
  label: string;
  /** Drawer subtitle. */
  sublabel: string;
  /** Live preview chips. Pass `null` while the preview is computing; pass
   *  `[]` to suppress the strip entirely (e.g. text too short). */
  chips: AiPasteChip[] | null;
  /** Right-aligned footer helper text when `text` is present. */
  fillsLabel?: string;

  /** Fired when the user commits via "Parse and fill" or the send button. */
  onApply: () => void;
  /** When true, primary button reads "Parsing…" and inputs are disabled. */
  isApplying?: boolean;
};

export const AIComposer = forwardRef<AIComposerHandle, AIComposerProps>(
  function AIComposer(
    {
      open,
      onOpenChange,
      text,
      onTextChange,
      sample,
      placeholder,
      label,
      sublabel,
      chips,
      fillsLabel,
      onApply,
      isApplying = false,
      consentTenantSlug,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // One-time consent notice. Hidden when no tenant slug is passed (no
    // consent surface) or when the user has already dismissed for this
    // tenant. Lazy useState initializer reads localStorage once at mount
    // — avoids the "setState-in-effect cascading render" lint rule that a
    // useEffect-based read would trigger. Trade-off: if the user dismisses
    // the notice in tab A while tab B's drawer is open, tab B won't
    // update until a remount. Acceptable for a one-time consent surface.
    const consentKey = consentTenantSlug
      ? `fluxora.ai.consent.${consentTenantSlug}`
      : null;
    const [consentDismissed, setConsentDismissed] = useState(() => {
      if (!consentKey || typeof window === "undefined") return true;
      return window.localStorage.getItem(consentKey) !== null;
    });
    const needsConsent = open && consentKey !== null && !consentDismissed;
    const dismissConsent = () => {
      if (consentKey && typeof window !== "undefined") {
        window.localStorage.setItem(consentKey, new Date().toISOString());
      }
      setConsentDismissed(true);
    };

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    // Auto-focus when the drawer opens. Skip when already applying so we
    // don't yank focus mid-mutation.
    useEffect(() => {
      if (open && !isApplying) {
        // RAF so the focus happens after the max-height transition starts
        // — keeps the entrance from looking janky on slower machines.
        const id = requestAnimationFrame(() => textareaRef.current?.focus());
        return () => cancelAnimationFrame(id);
      }
    }, [open, isApplying]);

    // Esc closes the drawer when the textarea has focus.
    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
      // Cmd+Enter (or Ctrl+Enter) is a power-user shortcut for "Parse and fill".
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim().length > 0) {
        e.preventDefault();
        onApply();
      }
    }

    const hasText = text.trim().length > 0;

    return (
      <div
        className={cn(
          // Wrapper animates max-height + opacity + margin in lock-step.
          "overflow-hidden transition-[max-height,opacity,margin] duration-[240ms] ease-[cubic-bezier(.2,0,0,1)]",
          open
            ? "mb-[22px] max-h-[520px] opacity-100"
            : "mb-0 max-h-0 opacity-0",
        )}
        // aria-hidden when closed so screen readers don't announce the empty drawer
        aria-hidden={!open}
      >
        <div className="overflow-hidden rounded-lg border border-border-soft bg-card shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]">
          {/* Drawer head */}
          <div className="flex items-start justify-between gap-3 border-b border-border-soft px-[18px] pt-[14px] pb-[10px]">
            <div>
              <div className="text-[14px] font-medium text-ink">{label}</div>
              <div className="mt-0.5 text-[12px] text-subtle">{sublabel}</div>
            </div>
            <div className="flex items-center gap-2">
              {!hasText && sample ? (
                <button
                  type="button"
                  onClick={() => onTextChange(sample)}
                  disabled={isApplying}
                  className="text-[12px] text-forest underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Try sample
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="-mr-1 inline-flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface hover:text-ink"
              >
                <X className="size-3.5 stroke-[1.5]" aria-hidden />
              </button>
            </div>
          </div>

          {/* One-time AI consent notice. Only renders on the first open
              per tenant — dismissal is remembered in localStorage so users
              who've acknowledged once never see this again. Tenants whose
              data policy disallows AI egress should disable the feature
              flag (DISTRIBUTION_AI_ASSISTED_ENTRY) entirely; this notice
              is a heads-up, not a switch. */}
          {needsConsent ? (
            <div className="flex items-start justify-between gap-3 border-b border-warning-border bg-warning-bg px-[18px] py-[10px] text-[12px] text-warning-fg">
              <span>
                Paste text gets sent to OpenAI for parsing. Turn this off
                in workspace settings if your data policy disallows.
              </span>
              <button
                type="button"
                onClick={dismissConsent}
                className="shrink-0 rounded-sm border-[0.5px] border-warning-border bg-card-warm px-2 py-[3px] text-[11.5px] font-medium text-warning-fg hover:bg-card"
              >
                Got it
              </button>
            </div>
          ) : null}

          {/* Composer body */}
          <div className="bg-card-warm px-4 pt-3 pb-3.5">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => onTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isApplying}
                rows={3}
                className={cn(
                  "block w-full resize-y rounded-md border border-border-soft bg-card",
                  "pt-2.5 pr-[52px] pb-2.5 pl-3",
                  "font-sans text-[13.5px] leading-[1.5] text-ink",
                  "placeholder:text-muted",
                  "focus:border-forest focus:outline-none focus:ring-[3px] focus:ring-forest/[0.18]",
                  "min-h-[76px]",
                )}
              />
              <button
                type="button"
                onClick={() => hasText && !isApplying && onApply()}
                disabled={!hasText || isApplying}
                aria-label="Parse with AI"
                className={cn(
                  "absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-full transition-colors",
                  hasText && !isApplying
                    ? "bg-forest text-card-warm hover:bg-forest-mid"
                    : "bg-forest-bright text-card-warm/80 cursor-not-allowed",
                )}
              >
                <ArrowUp className="size-[15px] stroke-[1.5]" aria-hidden />
              </button>
            </div>

            {/* Live preview chip strip — appears once text is in the box.
                A null `chips` value renders the dashed rule + label without
                chips (preview is computing); an empty array suppresses it. */}
            {hasText && chips !== null && chips.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-2.5">
                <span className="inline-flex items-center gap-1.5 pr-1 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-forest">
                  <Sparkles className="size-[11px] stroke-[1.5]" aria-hidden />
                  Will fill
                </span>
                {chips.map((c, i) => (
                  <PreviewChip key={i} chip={c} />
                ))}
              </div>
            ) : null}

            {/* Footer */}
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-subtle">
                {hasText
                  ? (fillsLabel ?? "Hit Parse and fill when you're ready.")
                  : "Empty — paste a message above or try a sample."}
              </span>
              <div className="flex items-center gap-2">
                {hasText && !isApplying ? (
                  <button
                    type="button"
                    onClick={() => onTextChange("")}
                    className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm hover:bg-card"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => hasText && !isApplying && onApply()}
                  disabled={!hasText || isApplying}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    hasText && !isApplying
                      ? "bg-forest text-card-warm hover:bg-forest-mid"
                      : "bg-forest-bright text-card-warm/80 cursor-not-allowed",
                  )}
                >
                  <Sparkles className="size-[13px] stroke-[1.5]" aria-hidden />
                  {isApplying ? "Parsing…" : "Parse and fill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// usePageBodyPaste — opens the composer when the user pastes anywhere on the
// page while no input is focused. Lets the ⌘V hint on the pill be more than
// a label. Caller passes `enabled` so it disables when the drawer is already
// open, or when the feature isn't available for this tenant.
// ---------------------------------------------------------------------------

export function usePageBodyPaste(args: {
  enabled: boolean;
  onPaste: (text: string) => void;
}) {
  const { enabled, onPaste } = args;
  // Latest-callback ref so the effect doesn't re-bind every render.
  const onPasteRef = useRef(onPaste);
  useEffect(() => {
    onPasteRef.current = onPaste;
  }, [onPaste]);

  useEffect(() => {
    if (!enabled) return;
    function handlePaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Skip when the user is already pasting into an input or textarea —
      // they're filling a field, not invoking AI prefill.
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (text.trim().length === 0) return;
      onPasteRef.current(text);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enabled]);
}
