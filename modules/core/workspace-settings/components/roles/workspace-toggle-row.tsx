"use client";

import { cn } from "@/lib/utils";

/**
 * Boolean toggle row used inside the "Workspace controls" group. Visual-only —
 * the per-tenant role schema isn't wired yet, so `onToggle` is omitted today
 * and the switch renders read-only with `cursor: not-allowed`.
 */
export function WorkspaceToggleRow({
  label,
  description,
  enabled,
  disabled = true,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3.5 border-t border-divider px-[18px] py-3.5 first-of-type:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[12px] text-subtle">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={disabled}
        onClick={() => onToggle?.(!enabled)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          enabled ? "bg-forest-mid" : "bg-surface-deep",
          disabled && "cursor-not-allowed opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-card shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left]",
            enabled ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
