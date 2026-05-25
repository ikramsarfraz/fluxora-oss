"use client";

import { Checkbox } from "@/components/ui/checkbox";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (n: number) => n.toLocaleString("en-US");

export function ReviewFooterStrip({
  rememberAliases,
  onRememberAliasesChange,
  totalLineCount,
  totalCases,
  totalWeightLbs,
  chargesTotal,
  billTotal,
}: {
  rememberAliases: boolean;
  onRememberAliasesChange: (value: boolean) => void;
  /** Total product lines (excludes fees + skipped + deleted). */
  totalLineCount: number;
  totalCases: number;
  totalWeightLbs: number;
  /**
   * Sum of all non-inventory charges (freight + fuel + tax + etc.) — split
   * out so the user can sanity-check "$X in lines + $Y in charges =
   * $Z on the bill" before posting. Hidden when zero.
   */
  chargesTotal: number;
  billTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 border-t border-border-default bg-card px-[22px] py-3">
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-subtle">
        <Checkbox
          checked={rememberAliases}
          onCheckedChange={value => onRememberAliasesChange(value === true)}
        />
        Remember my product mappings as aliases for this supplier
      </label>

      <div className="flex items-center gap-5">
        <FooterStat
          label={totalLineCount === 1 ? "Line" : "Lines"}
          value={fmtInt(totalLineCount)}
        />
        <FooterStat label="Cases" value={fmtInt(totalCases)} />
        <FooterStat label="Total weight" value={`${fmt(totalWeightLbs)} lb`} />
        {chargesTotal !== 0 ? (
          <FooterStat label="Charges" value={`$${fmt(chargesTotal)}`} />
        ) : null}

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Bill total
          </div>
          <div className="font-mono text-[18px] font-bold tabular-nums text-ink">
            ${fmt(billTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </div>
      <div className="font-mono text-[13px] font-medium tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}
