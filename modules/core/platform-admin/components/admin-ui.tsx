import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Platform-admin design-system primitives.
 *
 * These encode the Fluxora "ledger" look (cream canvas, forest ink, serif
 * numerals) for the reserved `/admin` host. They are presentational and
 * server-safe — compose them inside route components rather than reaching for
 * raw markup, so every admin screen reads as a sibling.
 *
 * Colors/spacing all reference the theme tokens defined in `app/globals.css`
 * (`bg-surface`, `text-forest`, `success-*`, etc.). Borders are the 0.5px
 * hairlines the design calls for.
 */

/* ── Status pill ─────────────────────────────────────────────── */

export type PillTone =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "neutral"
  | "outline";

const PILL_TONES: Record<PillTone, string> = {
  success: "bg-success-bg border-success-border text-success-fg",
  info: "bg-info-bg border-info-border text-info-fg",
  warning: "bg-warning-bg border-warning-border text-warning-fg",
  danger: "bg-danger-bg border-danger-border text-danger-fg",
  neutral: "bg-surface border-border-default text-ink-warm",
  outline: "bg-card border-border-default text-ink-warm",
};

/**
 * Small status badge. Uses a colored dot + text label so status is never
 * conveyed by color alone (a11y). Pass `dot={false}` for non-status tags
 * (e.g. a plan name).
 */
export function Pill({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-[0.5px] px-2.5 py-1 text-xs leading-none font-normal",
        PILL_TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}

/* ── Code badge (mono identifier chip) ───────────────────────── */

export function BadgeCode({
  muted = false,
  className,
  children,
}: {
  muted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-[0.5px] px-2 py-[3px] font-mono text-[11px]",
        muted
          ? "border-border-default bg-surface text-subtle"
          : "border-forest-tint-deep bg-forest-tint text-forest",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Callout ─────────────────────────────────────────────────── */

export function Callout({
  tone = "info",
  className,
  children,
}: {
  tone?: "warning" | "info";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border-[0.5px] px-4 py-3.5 text-[13px] leading-relaxed",
        tone === "warning"
          ? "bg-warning-bg border-warning-border text-warning-fg"
          : "bg-surface border-border-default text-ink-warm",
        "[&_strong]:font-medium",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Detail layout: main column + sticky summary rail ────────── */

/**
 * Two-column detail layout. Children are rendered in order: the main column
 * first, the summary rail second. Collapses to a single column below 1180px.
 */
export function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 min-[1180px]:grid-cols-[minmax(0,1fr)_340px]">
      {children}
    </div>
  );
}

export function DetailRail({
  "aria-label": ariaLabel,
  children,
}: {
  "aria-label": string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={ariaLabel}
      className="flex flex-col gap-4 min-[1180px]:sticky min-[1180px]:top-[72px]"
    >
      {children}
    </aside>
  );
}

export function RailCard({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border-soft bg-card rounded-lg border-[0.5px] p-5 shadow-sm",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <span className="font-serif text-[17px] font-medium tracking-[-0.01em] text-ink">
              {title}
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Small uppercase section label used inside rail cards. */
export function RailEyebrow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "font-sans text-[10px] font-medium tracking-[0.12em] text-muted uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ── Definition list (label left, value right) ───────────────── */

export function DefList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <dl className={cn("flex flex-col", className)}>{children}</dl>;
}

export function DefRow({
  label,
  value,
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-divider flex items-baseline justify-between gap-4 border-b-[0.5px] py-[9px] last:border-b-0">
      <dt className="text-[13px] text-subtle">{label}</dt>
      <dd
        className={cn(
          "m-0 text-right text-sm text-ink",
          mono ? "font-mono font-normal" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Rail count rows (serif values) ──────────────────────────── */

export function RailRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function RailRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="border-divider flex items-baseline justify-between border-b-[0.5px] py-2 last:border-b-0">
      <span className="text-[13px] text-subtle">{label}</span>
      <span className="font-serif text-lg font-medium tracking-[-0.01em] text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** Usage row: "Portal users  2 / Unlimited". `value` is the serif emphasis. */
export function UsageLine({
  label,
  value,
  suffix,
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <div className="border-divider flex items-baseline justify-between border-b-[0.5px] py-2 text-[13px] tabular-nums last:border-b-0">
      <span className="text-subtle">{label}</span>
      <span className="text-ink">
        <strong className="font-serif text-[15px] font-medium">{value}</strong>
        {suffix ? <span className="text-subtle"> {suffix}</span> : null}
      </span>
    </div>
  );
}
