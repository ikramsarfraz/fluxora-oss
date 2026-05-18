"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type MouseEvent,
} from "react";

/**
 * Per-line lot-number + expiration-date override state. Both fields are
 * optional — null/empty means the server falls back to its defaults
 * (auto-generated lot number like `SUPP-YYYYMMDD-SKU`, expiry =
 * receiveDate + 7 days). Mirrors the `lotNumberOverride` /
 * `expirationDateOverride` fields on SupplierInvoiceLineInput.
 */
export type LineLotExpiryState = {
  lotNumberOverride: string;
  expirationDateOverride: string;
};

export type LineLotExpirySubmitShape = {
  lotNumberOverride: string | null;
  expirationDateOverride: string | null;
};

export function emptyLineLotExpiryState(): LineLotExpiryState {
  return { lotNumberOverride: "", expirationDateOverride: "" };
}

/** Normalize the editor state for the submit payload (trim + nulls). */
export function resolveLineLotExpirySubmit(
  state: LineLotExpiryState,
): LineLotExpirySubmitShape {
  const lot = state.lotNumberOverride.trim();
  const exp = state.expirationDateOverride.trim();
  return {
    lotNumberOverride: lot.length > 0 ? lot : null,
    expirationDateOverride: exp.length > 0 ? exp : null,
  };
}

/**
 * Inline tray that opens below a LineRow, beside the weight editor.
 * Two text fields — lot number override and expiry date override —
 * with a gentle warning when the picked expiry is within 30 days.
 * Pure controlled component; the container persists every keystroke.
 */
export function LineLotExpiryEditor({
  state,
  onChange,
  onClose,
}: {
  state: LineLotExpiryState;
  onChange: (next: LineLotExpiryState) => void;
  onClose?: () => void;
}) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  const setLot = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...state, lotNumberOverride: e.target.value });
  };
  const setExpiry = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...state, expirationDateOverride: e.target.value });
  };

  // Warn (not block) when the picked expiry is within 30 days of today.
  // Matches the manual form's behavior — perishables often have short
  // shelf life but we don't want to surprise the user.
  const expiryWarning = useMemo(() => {
    const v = state.expirationDateOverride;
    if (!v) return null;
    const picked = Date.parse(v);
    if (!Number.isFinite(picked)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = today.getTime() + 30 * 24 * 60 * 60 * 1000;
    if (picked < today.getTime()) return "Expiry is in the past.";
    if (picked < threshold) return "Expiry is within 30 days.";
    return null;
  }, [state.expirationDateOverride]);

  // Focus the lot input on mount so screen-reader / keyboard users
  // land in the first editable field instead of below the row.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>("input");
    input?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      onClick={stop}
      role="region"
      aria-label="Lot number and expiration override"
      className="mt-2 rounded-lg border border-stone-line bg-stone-line2/50 p-3 text-[12px]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.06em] text-[11px] text-stone-muted">
          Lot &amp; expiry override
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-md border border-stone-line bg-stone-surface px-2 py-0.5 text-[10.5px] font-medium text-stone-muted hover:text-stone-ink"
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-stone-muted">
            Lot number
            <span className="ml-1 font-mono text-stone-muted/70">
              (auto on receive if blank)
            </span>
          </span>
          <input
            type="text"
            maxLength={128}
            value={state.lotNumberOverride}
            onChange={setLot}
            onClick={stop}
            placeholder="SUPP-YYYYMMDD-SKU"
            className="h-9 rounded-md border border-stone-line bg-stone-surface px-3 font-mono text-[12px] outline-none focus:border-stone-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-stone-muted">
            Expiration date
            <span className="ml-1 font-mono text-stone-muted/70">
              (receive + 7d if blank)
            </span>
          </span>
          <input
            type="date"
            value={state.expirationDateOverride}
            onChange={setExpiry}
            onClick={stop}
            className="h-9 rounded-md border border-stone-line bg-stone-surface px-3 text-[12px] outline-none focus:border-stone-ink"
          />
          {expiryWarning ? (
            <span
              className="text-[11px]"
              style={{ color: "oklch(60% 0.16 35)" }}
            >
              ⚠ {expiryWarning}
            </span>
          ) : null}
        </label>
      </div>
    </div>
  );
}
