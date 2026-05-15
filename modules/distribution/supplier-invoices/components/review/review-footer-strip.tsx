"use client";

import { Checkbox } from "@/components/ui/checkbox";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReviewFooterStrip({
  rememberAliases,
  onRememberAliasesChange,
  billTotal,
}: {
  rememberAliases: boolean;
  onRememberAliasesChange: (value: boolean) => void;
  billTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 border-t border-stone-line bg-stone-surface px-[22px] py-3">
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-stone-muted">
        <Checkbox
          checked={rememberAliases}
          onCheckedChange={value => onRememberAliasesChange(value === true)}
        />
        Remember my product mappings as aliases for this supplier
      </label>
      <div className="flex items-center gap-[18px]">
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
            Bill total
          </div>
          <div className="font-mono text-[18px] font-bold tabular-nums text-stone-ink">
            ${fmt(billTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
