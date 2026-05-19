"use client";

import { cn } from "@/lib/utils";
import {
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_ORDER,
  type PermissionLevel,
} from "@/lib/auth/permission-levels";

/**
 * 4-state segmented control (None / View / Edit / Full).
 * Active option is colour-coded; non-None levels also show a small dot in
 * the current colour.
 *
 * Today the control is read-only — clicks would have nowhere to persist
 * until the per-tenant role schema lands. When `disabled` we still keep the
 * tab visible (semi-transparent + `cursor: not-allowed`) so the matrix is
 * legible.
 */
export function PermissionLevelControl({
  value,
  disabled = true,
  onChange,
  label,
}: {
  value: PermissionLevel;
  disabled?: boolean;
  onChange?: (next: PermissionLevel) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid grid-cols-4 gap-0 rounded-lg bg-divider p-[3px]",
        disabled && "opacity-90",
      )}
    >
      {PERMISSION_LEVEL_ORDER.map(lvl => {
        const isActive = lvl === value;
        return (
          <button
            key={lvl}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange?.(lvl)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              disabled && "cursor-not-allowed",
              isActive
                ? cn(
                    "bg-card shadow-[0_1px_2px_rgba(0,0,0,.06)]",
                    LEVEL_TEXT_CLASS[lvl],
                  )
                : "text-ink-warm hover:text-ink",
            )}
          >
            {isActive && lvl !== "none" ? (
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", LEVEL_DOT_CLASS[lvl])}
              />
            ) : null}
            <span>{PERMISSION_LEVEL_LABELS[lvl]}</span>
          </button>
        );
      })}
    </div>
  );
}

const LEVEL_TEXT_CLASS: Record<PermissionLevel, string> = {
  none: "text-subtle",
  view: "text-[oklch(60%_0.15_240)]",
  edit: "text-primary",
  full: "text-[oklch(58%_0.13_155)]",
};

const LEVEL_DOT_CLASS: Record<PermissionLevel, string> = {
  none: "bg-surface-deep",
  view: "bg-[oklch(60%_0.15_240)]",
  edit: "bg-primary",
  full: "bg-[oklch(58%_0.13_155)]",
};

/**
 * Compact pill used inside the Compare matrix — same colour scheme as the
 * segmented control's active option, but as a chip rather than a segmented
 * row. Boolean rows use "Yes" / "No" instead of a level word.
 */
export function PermissionLevelChip({
  value,
  boolean: isBoolean,
}: {
  value: PermissionLevel | "yes" | "no";
  boolean?: boolean;
}) {
  if (isBoolean) {
    const on = value === "yes";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[12px] font-medium",
          on ? "text-[oklch(58%_0.13_155)]" : "text-subtle",
        )}
      >
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", on ? "bg-[oklch(58%_0.13_155)]" : "bg-surface-deep")}
        />
        {on ? "Yes" : "No"}
      </span>
    );
  }
  const level = value as PermissionLevel;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        LEVEL_TEXT_CLASS[level],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", LEVEL_DOT_CLASS[level])} />
      {PERMISSION_LEVEL_LABELS[level]}
    </span>
  );
}
