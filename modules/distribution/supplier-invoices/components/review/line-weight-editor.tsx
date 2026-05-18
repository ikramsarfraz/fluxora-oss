"use client";

import { useCallback, type ChangeEvent, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

import {
  computeDraftLineWeight,
  serializeDraftCaseWeights,
  type SupplierInvoiceWeightEntryMode,
} from "../../utils/case-weights";

/**
 * Per-line weight-editor state — mirrors the manual form's three entry
 * modes (manual_case_weights / default_case_weight / total_weight). The
 * shape matches what `case-weights.ts` helpers expect, so we can reuse
 * `computeDraftLineWeight` + `serializeDraftCaseWeights` for resolution
 * and persistence without duplicating logic.
 *
 * `unitType` lives here too even though it's not a "weight" per se —
 * switching to `fixed_case` hides the per-case modes (each case has a
 * uniform weight stamped at the product level) and changes how the
 * server interprets `weightLbs` on the resulting lot. Keeping it in the
 * same state object means a single override per line covers both knobs.
 */
export type LineWeightState = {
  unitType: "catch_weight" | "fixed_case";
  weightEntryMode: SupplierInvoiceWeightEntryMode;
  weightLbs: string;
  defaultCaseWeightLbs: string;
  caseWeightEntries: string[];
};

export type LineWeightSubmitShape = {
  /** Resolved total, formatted to 4 decimal places — matches manual form output. */
  weightLbs: string;
  /** JSON array of per-case weights when the mode is non-total, else null. */
  caseWeightsLbs: string | null;
  /** Either fixed_case or catch_weight — forwarded to SupplierInvoiceLineInput. */
  unitType: "catch_weight" | "fixed_case";
};

const MODE_OPTIONS: Array<{
  value: SupplierInvoiceWeightEntryMode;
  label: string;
  hint: string;
}> = [
  {
    value: "manual_case_weights",
    label: "Each case",
    hint: "Enter each case weight individually",
  },
  {
    value: "default_case_weight",
    label: "Same value",
    hint: "Apply one weight to all cases",
  },
  {
    value: "total_weight",
    label: "Total ÷ cases",
    hint: "Distribute a total evenly across cases",
  },
];

/**
 * Build the initial editor state when opening the tray for the first
 * time. Seeds with the parser's resolved total weight in `total_weight`
 * mode so the happy-path confirm is "Just close — total is correct."
 */
export function initialLineWeightState(args: {
  quantityCases: number;
  totalWeightLbs: number;
  unitType: "catch_weight" | "fixed_case";
}): LineWeightState {
  return {
    unitType: args.unitType,
    weightEntryMode: "total_weight",
    weightLbs:
      args.totalWeightLbs > 0
        ? args.totalWeightLbs.toFixed(2).replace(/\.?0+$/, "")
        : "",
    defaultCaseWeightLbs: "",
    caseWeightEntries: Array.from(
      { length: Math.max(0, args.quantityCases) },
      () => "",
    ),
  };
}

/**
 * Compute the resolved total + serialized per-case array from the editor
 * state. Used by the container to build the submit payload when a line
 * has a weight override.
 */
export function resolveLineWeightSubmit(args: {
  quantityCases: number;
  state: LineWeightState;
}): LineWeightSubmitShape {
  const shared = {
    unitType: args.state.unitType,
    quantityCases: args.quantityCases,
    weightLbs: args.state.weightLbs,
    weightEntryMode: args.state.weightEntryMode,
    defaultCaseWeightLbs: args.state.defaultCaseWeightLbs,
    caseWeightEntries: args.state.caseWeightEntries,
  };
  const total = computeDraftLineWeight(shared);
  return {
    weightLbs: total.toFixed(4),
    caseWeightsLbs: serializeDraftCaseWeights(shared),
    unitType: args.state.unitType,
  };
}

/**
 * Inline tray that slots below a LineRow in the review queue. Pure
 * controlled component — owns no state, fires `onChange` on every edit
 * so the container can persist immediately (the review flow is
 * edit-as-you-go, no save buttons).
 */
export function LineWeightEditor({
  quantityCases,
  state,
  onChange,
  onClose,
}: {
  quantityCases: number;
  state: LineWeightState;
  onChange: (next: LineWeightState) => void;
  /** Optional — when supplied, renders a close button in the header. */
  onClose?: () => void;
}) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  const setMode = useCallback(
    (mode: SupplierInvoiceWeightEntryMode) => {
      onChange({ ...state, weightEntryMode: mode });
    },
    [state, onChange],
  );

  const setUnitType = useCallback(
    (unitType: "catch_weight" | "fixed_case") => {
      // Switching to fixed_case forces total_weight mode — per-case modes
      // are meaningless when the server treats weight as a single number
      // stamped on every case alike. Mirrors the manual form's reset.
      onChange({
        ...state,
        unitType,
        weightEntryMode:
          unitType === "fixed_case" ? "total_weight" : state.weightEntryMode,
      });
    },
    [state, onChange],
  );

  const setWeightLbs = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...state, weightLbs: e.target.value });
  };
  const setDefaultCaseWeight = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...state, defaultCaseWeightLbs: e.target.value });
  };
  const setCaseEntry = (i: number, value: string) => {
    const next = state.caseWeightEntries.slice();
    while (next.length <= i) next.push("");
    next[i] = value;
    onChange({ ...state, caseWeightEntries: next });
  };

  const totalWeight = computeDraftLineWeight({
    unitType: state.unitType,
    quantityCases,
    weightLbs: state.weightLbs,
    weightEntryMode: state.weightEntryMode,
    defaultCaseWeightLbs: state.defaultCaseWeightLbs,
    caseWeightEntries: state.caseWeightEntries,
  });
  const avgPerCase = quantityCases > 0 ? totalWeight / quantityCases : 0;
  const isFixedCase = state.unitType === "fixed_case";

  const activeHint =
    MODE_OPTIONS.find(o => o.value === state.weightEntryMode)?.hint ?? "";

  return (
    <div
      onClick={stop}
      className="mt-2 rounded-lg border border-stone-line bg-stone-line2/50 p-3 text-[12px]"
    >
      {/* Unit-type toggle. Catch-weight = each case weighed individually
          (meat, produce); fixed-case = uniform weight applied per case
          (canned goods, sealed retail bags). Switching to fixed_case
          collapses the per-case modes since they no longer apply. */}
      <div className="mb-3 flex items-center gap-2 text-[11px]">
        <span className="font-semibold uppercase tracking-[0.06em] text-stone-muted">
          Unit type
        </span>
        <div className="flex gap-1 rounded-md border border-stone-line bg-stone-surface p-0.5">
          {(
            [
              { value: "catch_weight", label: "Catch-weight" },
              { value: "fixed_case", label: "Fixed case" },
            ] as const
          ).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={e => {
                e.stopPropagation();
                setUnitType(opt.value);
              }}
              className={cn(
                "rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                state.unitType === opt.value
                  ? "bg-stone-ink text-stone-surface"
                  : "text-stone-muted hover:text-stone-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isFixedCase ? (
            <>
              <div className="flex gap-1 rounded-md border border-stone-line bg-stone-surface p-0.5">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setMode(opt.value);
                    }}
                    className={cn(
                      "rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                      state.weightEntryMode === opt.value
                        ? "bg-stone-ink text-stone-surface"
                        : "text-stone-muted hover:text-stone-ink",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-stone-muted">{activeHint}</span>
            </>
          ) : (
            <span className="text-[11px] text-stone-muted">
              Each case weighs the same — enter the total or per-case weight below.
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2.5 text-[11px] text-stone-muted">
          <span>{quantityCases} cs</span>
          <span>·</span>
          <span className="font-mono tabular-nums">
            {avgPerCase.toFixed(2)} lb/cs
          </span>
          <span>·</span>
          <span className="font-mono font-semibold tabular-nums text-stone-ink">
            {totalWeight.toFixed(2)} lb
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClose();
              }}
              className="ml-1.5 rounded-md border border-stone-line bg-stone-surface px-2 py-0.5 text-[10.5px] font-medium text-stone-muted hover:text-stone-ink"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      {state.weightEntryMode === "total_weight" ? (
        <input
          type="number"
          min={0}
          step="0.01"
          value={state.weightLbs}
          onChange={setWeightLbs}
          onClick={stop}
          placeholder="Total weight (lbs)"
          className="h-9 w-48 rounded-md border border-stone-line bg-stone-surface px-3 text-right font-mono text-[12px] tabular-nums outline-none focus:border-stone-ink"
        />
      ) : null}

      {state.weightEntryMode === "default_case_weight" ? (
        <input
          type="number"
          min={0}
          step="0.01"
          value={state.defaultCaseWeightLbs}
          onChange={setDefaultCaseWeight}
          onClick={stop}
          placeholder="Weight per case (lbs)"
          className="h-9 w-48 rounded-md border border-stone-line bg-stone-surface px-3 text-right font-mono text-[12px] tabular-nums outline-none focus:border-stone-ink"
        />
      ) : null}

      {state.weightEntryMode === "manual_case_weights" ? (
        quantityCases > 0 ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
          >
            {Array.from({ length: quantityCases }, (_, i) => (
              <div key={i} className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-stone-muted">
                  #{i + 1}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={state.caseWeightEntries[i] ?? ""}
                  onChange={e => setCaseEntry(i, e.target.value)}
                  onClick={stop}
                  placeholder="0.00"
                  className="h-9 w-full rounded-md border border-stone-line bg-stone-surface pl-7 pr-7 text-right font-mono text-[12px] tabular-nums outline-none focus:border-stone-ink"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-muted">
                  lb
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-stone-muted">
            Set a case count before entering per-case weights.
          </div>
        )
      ) : null}
    </div>
  );
}
