"use client";

import type { ReactNode } from "react";

import { REVIEW_COLORS } from "./tokens";

export function ParsedField({
  label,
  required,
  action,
  chip,
  children,
}: {
  label: string;
  required?: boolean;
  /** Right-aligned label adornment, e.g. a "Create supplier" link. */
  action?: ReactNode;
  /** Confidence chip rendered under the field. */
  chip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-[5px] flex items-center justify-between">
        <label className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-stone-muted">
          {label}
          {required ? (
            <span className="ml-[3px]" style={{ color: REVIEW_COLORS.warn }}>
              *
            </span>
          ) : null}
        </label>
        {action ?? null}
      </div>
      {children}
      {chip ? <div className="mt-[5px]">{chip}</div> : null}
    </div>
  );
}
